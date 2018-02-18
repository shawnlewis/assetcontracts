pragma solidity ^0.4.18;

import './CHRPToken.sol';
import './AssetOwnership.sol';
import './AssetMinter.sol';

contract AssetAuction is AssetMinter {
    // Auction bids are valid in startBlock through startBlock + duration - 1. If no one buys by
    // startBlock + duration the auction ends in favor of the initial bidder.
    // Storage size: 160 bytes
    struct Auction {
        address bidder;       // current bidder
        address helper;
        uint128 currentBid;
        uint128 startPrice;   // price at block within which auction was started
        uint128 endPrice;     // price at index startedAt + duration
        uint64 duration;      // in blocks
        uint64 startedAt;     // block number

        int128 curveA;
        int128 curveB;
    }

    // Triggered whenever a new auction is created.
    event Created(uint256 _tokenId, uint256 _startPrice, uint256 _endPrice, uint256 _duration, uint256 _startedAt);
    // Triggered whenever someone wins an auction outright, by bidding over the buy now
    // price for any unuowned asset, or by bidding over the current price for an ongoing
    // auction. Not triggered in the case where a user bids enough to beat current bidder
    // but not enough to win outright, and then the auction ends. In this case the
    // user wins, but no event is triggered, because there is no transaction in which
    // to trigger it. Same applies for a user who opens an auction and is never outbid.
    event Won(address _winner, uint256 _tokenId, uint256 _amount);

    CHRPToken public tokenContract;
    AssetOwnership public assetContract;

    address owner;

    uint128 constant TOKEN_MULT = 10**18;

    // All variables ending in 'Fraction' are actually numerators, true fraction
    // is numerator / 1000

    // Mapping from asset ID to all auctions, ongoing or ended.
    mapping (uint256 => Auction) public assetAuctions;
    // Mapping from immediatley won asset IDs to price they were
    // won for.
    mapping (uint256 => uint128) public assetsWonImmediately;

    // Global minimum bid, this is also effectively the minimum bid required to start
    // an auction.
    uint128 public minBid = 10 * TOKEN_MULT;

    // The current auction start price, auctions will start at the max of this price or
    // startPriceBidMult * opening bid.
    uint128 public currentStartPrice = 100 * TOKEN_MULT;
    uint128 public startPriceBidMult = 10;
    // If user bids greater than currentStartPrice times buyNowFraction, they win
    // immediately.
    uint128 public buyNowFraction = 1010;   // 101%

    // Duration of all auctions, in blocks.
    uint64 public auctionDuration = 1000;

    // Users receive some of the proceeds from being outbid. This caps the
    // amount they can receive based on their original bid.
    uint128 public maxReturnMult = 10;
    // Amount of overbid that goes back to previous bidder, vs going to fees
    uint128 public returnFraction = 500;

    // Auction curve will be calculated so that second to last point will be
    // this much greater than final point (opening bid).
    uint128 public curveFraction = 1500;     // 150%

    // The amount by which a user must outbid the previous bid.
    uint128 public outbidFraction = 1500;   // 150%

    // Fraction of proceeds that go to contract owner.
    uint128 public feeFraction = 100;       // 10%

    // Fraction of proceeds that go to helper (helper is registered only
    // on auction start bid). This is a way to reward sites that get users
    // to start auctions, potentially by helping them find worthy assets.
    uint128 public helperFraction = 500; // 50%

    // Count number of times params have changed. Can be used to detect
    // that they've been updated
    uint64 public paramChanges = 0;

    function AssetAuction(address _assetContract, address _tokenContract, uint128 _minBid,
            uint128 _initialStartPrice, uint64 _auctionDuration, uint128 _buyNowFraction,
            uint128 _startPriceBidMult, uint128 _maxReturnMult, uint128 _returnFraction,
            uint128 _curveFraction,
            uint128 _outbidFraction, uint128 _feeFraction, uint128 _helperFraction) public
    {
        owner = msg.sender;

        assetContract = AssetOwnership(_assetContract);
        tokenContract = CHRPToken(_tokenContract);

        minBid = _minBid;
        currentStartPrice = _initialStartPrice;
        auctionDuration = _auctionDuration;
        buyNowFraction = _buyNowFraction;
        startPriceBidMult = _startPriceBidMult;
        maxReturnMult = _maxReturnMult;
        returnFraction = _returnFraction;
        curveFraction = _curveFraction;
        outbidFraction = _outbidFraction;
        feeFraction = _feeFraction;
        helperFraction = _helperFraction;
    }

    function _currentPrice(Auction storage auction) internal view returns (uint256) {
        require(block.number >= auction.startedAt);  // sanity
        uint64 runBlocks = uint64(block.number) - auction.startedAt;
        require(runBlocks < auction.duration);

        return uint256(curveValue(auction.curveA, auction.curveB,
                auction.startPrice, auction.duration, runBlocks));
    }

    function _finish(address winner, uint256 _tokenId, uint128 _amount) internal {
        Won(winner, _tokenId, _amount);
        if (_amount > currentStartPrice) {
            currentStartPrice = _amount;
        }
    }

    function _spend(address account, uint256 amount, address _helper) internal {
        // Throws if amount isn't enough
        uint256 fee = amount * feeFraction / 1000;
        tokenContract.controllerTransfer(account, owner, fee);
        uint256 helperEarnings = 0;
        if (_helper != 0x0) {
            helperEarnings = amount * helperFraction / 1000;
            tokenContract.controllerTransfer(account, _helper, helperEarnings);
        }
        tokenContract.controllerBurn(msg.sender, amount - fee - helperEarnings);
    }

    function _startAuction(uint256 _tokenId, uint256 _amount, address _helper) internal {
        require(_amount == uint256(uint128(_amount)));

        // Withdraw from auction-starter. Will fail if sender doesn't have
        // enough.
        _spend(msg.sender, _amount, _helper);

        // Mint token to the sender, will fail if this token is owned.
        assetContract.delayedMint(msg.sender, _tokenId);

        if (_amount > currentStartPrice * buyNowFraction / 1000) {
            // Highest bid of all time, auto-win, no auction necessary.
            // Because we don't create an auction, stillMinting returns false, therefore the token
            // is owned by the bidder.
            assetsWonImmediately[_tokenId] = uint128(_amount);
            _finish(msg.sender, _tokenId, uint128(_amount));
            return;
        }

        uint128 startPrice = currentStartPrice;
        uint128 multStartPrice = uint128(_amount) * startPriceBidMult;
        if (multStartPrice > startPrice) {
            startPrice = multStartPrice;
        }

        uint128 endPrice = uint128(_amount);

        int128 curveA;
        int128 curveB;
        (curveA, curveB) = curveParams(startPrice, endPrice, auctionDuration, curveFraction);

        // No owner and no auction, the token has started minting and we've burned the bid,
        // start the auction.
        Auction memory newAuction = Auction(
            msg.sender,
            _helper,
            endPrice,
            startPrice,
            endPrice,
            auctionDuration,
            uint64(block.number),
            curveA,
            curveB
        );
        assetAuctions[_tokenId] = newAuction;
        Created(_tokenId, uint128(startPrice), uint128(endPrice), auctionDuration, now);
    }

    // The auction curve is a 2nd order polynomial, curveA/B/C are the polynomial
    // parameters for this specific curve. See curveParams for how they're defined.
    function curveValue(int128 curveA, int128 curveB, uint128 curveC, uint64 D, uint64 i)
            public pure returns (int128)
    {
        require(i <= D);
        require(curveC == uint128(int128(curveC)));

        int256 result = int256(curveA) * int256(i) * int256(i) + 
            int256(curveB) * int256(i) +
            int256(curveC);
        require(result == int256(int128(result)));
        return int128(result);
    }

    // The curve polynomial is defined by three points:
    //   (time0, startPrice (p0))
    //   (timeD, endPrice (pE))
    //   (timeD-1, endPrice * puMult)
    // In this way we ensure the second to last point on the curve is always at least
    // puMult * the last point.
    // It's also clipped to linear, ie if puMult would make the curve super-linear
    // we just make it linear.
    function curveParams(int256 p0, int256 pE, int256 D, int256 puMult)
            public pure returns (int128 curveA, int128 curveB)
    {
        int256 E = D - 1;
        int256 pPU = puMult * pE / 1000;
        int256 linearpPU = pE + (p0 - pE) / D;
        if (pPU > linearpPU) {
            pPU = linearpPU;
        }
        int256 bigCurveA = ((pE - p0) + D * (p0 - pPU) / E) / D;
        int256 bigCurveB = (pPU - p0) / E - bigCurveA * E;
        curveA = int128(bigCurveA);
        curveB = int128(bigCurveB);
        require(bigCurveA == int256(curveA));
        require(bigCurveB == int256(curveB));
    }

    function helperBid(uint256 _tokenId, uint256 _amount, address _helper) public {
        require(_amount == uint256(uint128(_amount)));
        require(_amount >= minBid);

        Auction storage auction = assetAuctions[_tokenId];
        if (auction.startedAt == 0) {
            _startAuction(_tokenId, _amount, _helper);
            // Now this contract owns the token, and an auction has been created.
        } else {
            // Throws if auction not running.
            uint256 currentPrice = _currentPrice(auction);

            require(_amount > outbidFraction * auction.currentBid / 1000);

            address bidder = auction.bidder;
            // Previous bidder gets their bid + some overage back.
            uint256 returnAmount = auction.currentBid +
                (_amount - auction.currentBid) * returnFraction / 1000;
            // overage capped at maxReturn
            uint256 maxReturn = maxReturnMult * auction.currentBid;
            if (returnAmount > maxReturn) {
                returnAmount = maxReturn;
            }
            uint256 burnAmount = _amount - returnAmount;
            
            // New bidder receives the asset
            assetContract.controllerTransfer(auction.bidder, msg.sender, _tokenId);
            auction.bidder = msg.sender;
            auction.currentBid = uint128(_amount);

            // Previous bidder receives tokens
            tokenContract.controllerTransfer(msg.sender, bidder, returnAmount);

            // Burn remaining
            if (burnAmount != 0) {
                _spend(msg.sender, burnAmount, auction.helper);
            }

            if (_amount > currentPrice) {
                // Won!
                assetAuctions[_tokenId].currentBid = uint128(_amount);
                _finish(msg.sender, _tokenId, uint128(_amount));
            }
        }
    }

    function bid(uint256 _tokenId, uint256 _amount) public {
        helperBid(_tokenId, _amount, 0);
    }

    function currentPrice(uint256 _tokenId) public view returns (uint256) {
        Auction storage auction = assetAuctions[_tokenId];
        return _currentPrice(auction);
    }

    struct HotAuction {
        uint256 assetId;
        uint128 currentBid;
    }

    function hotAuctions(uint256 _resultCount, uint256 _searchCount, bool _running) external view returns(uint256[] assetIds) {
        // TODO: accept startIndex so we can page through this?
        // TODO: check limits of this when using metamask
        require(_searchCount > 0);
        require(_resultCount > 0);
        uint256 searchCount = _searchCount;
        int256 total = int256(assetContract.totalSupply());
        HotAuction[] memory hot = new HotAuction[](_resultCount);
        for (int256 i = total - 1; i >= 0; i--) {
            // Bid is auction bid or bid of immediate winner
            uint256 assetId = assetContract.tokens(uint256(i));
            if (_running != stillMinting(assetId)) {
                continue;
            }

            if (searchCount == 0) {
                break;
            }
            searchCount--;

            // Find current min hot auction
            uint128 minHotBid = hot[0].currentBid;
            uint256 minIndex = 0;
            for (uint256 j = 1; j < _resultCount; j++) {
                if (hot[j].currentBid < minHotBid) {
                    minIndex = j;
                    minHotBid = hot[j].currentBid;
                }
            }

            Auction storage checkAuction = assetAuctions[assetId];
            uint128 assetBid = checkAuction.currentBid;
            if (assetBid == 0) {
                assetBid = assetsWonImmediately[assetId];
            }

            // if the current asset great than the min hot we found, overwrite min hot
            if (assetBid > hot[minIndex].currentBid) {
                hot[minIndex].assetId = assetId;
                hot[minIndex].currentBid = assetBid;
            }
        }

        uint256[] memory result = new uint256[](_resultCount);
        for (j = 0; j < _resultCount; j++) {
           result[j] = hot[j].assetId;
        }
        return result;
    }

    // AssetMinter interface
    function stillMinting(uint256 _tokenId) public view returns (bool) {
        Auction storage auction = assetAuctions[_tokenId];
        if (auction.startedAt == 0) {
            // auction not started, or deleted (ended)
            return false;
        }
        if (block.number >= auction.startedAt + auction.duration) {
            // auction ended
            return false;
        }
        uint256 curPrice = _currentPrice(auction);
        if (auction.currentBid >= curPrice) {
            // auction won by current bidder
            return false;
        }
        return true;
    }

    function updateParams(uint128 _minBid,
            uint64 _auctionDuration, uint128 _buyNowFraction,
            uint128 _startPriceBidMult, uint128 _maxReturnMult, uint128 _returnFraction,
            uint128 _curveFraction, uint128 _outbidFraction, uint128 _feeFraction,
            uint128 _helperFraction) public
    {
        require(msg.sender == owner);

        paramChanges += 1;

        minBid = _minBid;
        auctionDuration = _auctionDuration;
        buyNowFraction = _buyNowFraction;
        startPriceBidMult = _startPriceBidMult;
        maxReturnMult = _maxReturnMult;
        returnFraction = _returnFraction;
        curveFraction = _curveFraction;
        outbidFraction = _outbidFraction;
        feeFraction = _feeFraction;
        helperFraction = _helperFraction;
    }
}