const util = require('./util');

var CHRPToken = artifacts.require('./CHRPToken.sol');
var AssetOwnership = artifacts.require('./AssetOwnership.sol');
var AssetAuction = artifacts.require('./AssetAuction.sol');

// Useful web3 timing stuff:
//console.log('blockNumber', web3.eth.blockNumber);
//console.log('blockTime', web3.eth.getBlock(web3.eth.blockNumber).timestamp);
//web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [60], id: 0})
//web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0})

contract('AssetAuction', function(accounts) {
  var tokenContract;
  var assetOwnership;
  var assetAuction;

  beforeEach('setup', async function() {
    tokenContract = await CHRPToken.new(accounts[0]);
    assetOwnership = await AssetOwnership.new(accounts[0]);
    assetAuction = await AssetAuction.new(
      assetOwnership.address,
      tokenContract.address,
      util.ether(10), // minBid
      util.ether(100), // initialStartPrice
      20, // auctionDuration
      1010, // buyNowFraction
      10, // startPriceBidMult
      10, // maxReturnMult
      500, // returnFraction
      1500, // curveFraction
      1500, // outbidFraction
      100, // feeFraction
      500, // helperFraction
    );
    await assetOwnership.changeController(assetAuction.address, {
      from: accounts[0],
    });
    await tokenContract.changeController(assetAuction.address, {
      from: accounts[0],
    });
    // Accounts 1-3 start with 100k CHRP tokens.
    await tokenContract.transfer(accounts[1], web3.toWei(100e3, 'ether'), {
      from: accounts[0],
    });
    await tokenContract.transfer(accounts[2], web3.toWei(100e3, 'ether'), {
      from: accounts[0],
    });
    await tokenContract.transfer(accounts[3], web3.toWei(100e3, 'ether'), {
      from: accounts[0],
    });
  });

  it('buy it now', async function() {
    await assetAuction.bid(5, util.ether(1000), {from: accounts[1]});
    assert.equal(accounts[1], await assetOwnership.ownerOf(5));
    let event = await util.assertEvent(
      assetAuction,
      {
        event: 'Won',
        args: {_winner: accounts[1]},
      },
      {_tokenId: 5, _amount: util.ether(1000)},
    );
    // Price was burnt
    assert(util.ether(100e6 - 900).equals(await tokenContract.totalSupply()));
    // Winner no longer has the payment tokens
    assert(
      util
        .ether(100e3 - 1000)
        .equals(await tokenContract.balanceOf(accounts[1])),
    );
    // Owner received fee.
    assert(
      util
        .ether(100e6 - 300e3 + 100)
        .equals(await tokenContract.balanceOf(accounts[0])),
    );
  });

  it('buy it now with helper', async function() {
    await assetAuction.helperBid(5, util.ether(1000), accounts[3], {
      from: accounts[1],
    });
    assert.equal(accounts[1], await assetOwnership.ownerOf(5));
    let event = await util.assertEvent(
      assetAuction,
      {
        event: 'Won',
        args: {_winner: accounts[1]},
      },
      {_tokenId: 5, _amount: util.ether(1000)},
    );
    // Price was burnt
    assert(util.ether(100e6 - 400).equals(await tokenContract.totalSupply()));
    // Winner no longer has the payment tokens
    assert(
      util
        .ether(100e3 - 1000)
        .equals(await tokenContract.balanceOf(accounts[1])),
    );
    // Owner received fee.
    assert(
      util
        .ether(100e6 - 300e3 + 100)
        .equals(await tokenContract.balanceOf(accounts[0])),
    );
    // Helper received fee.
    assert(
      util
        .ether(100e3 + 500)
        .equals(await tokenContract.balanceOf(accounts[3])),
    );
  });

  it('winning bid during auction', async function() {
    // Account 1 starts auction, auction contract owns minted asset.
    await assetAuction.bid(5, web3.toWei(20, 'ether'), {from: accounts[1]});
    assert.equal(assetAuction.address, await assetOwnership.ownerOf(5));
    let event = await util.assertEvent(
      assetAuction,
      {event: 'Created'},
      {_tokenId: 5, _startPrice: util.ether(200)},
    );
    // Bidder can't transfer or approve.
    util.expectRevert(
      assetOwnership.transfer(accounts[4], 5, {from: accounts[1]}),
    );
    util.expectRevert(
      assetOwnership.approve(accounts[4], 5, {from: accounts[1]}),
    );

    util.mineBlocks(web3, 1);

    let currentPrice = await assetAuction.currentPrice(5);
    //console.log('Price after 3 blocks: ', currentPrice.toString());
    assert(util.ether(173.0).equals(currentPrice));

    // Account 2 bids enough to win auction.
    await assetAuction.bid(5, util.ether(198), {from: accounts[2]});
    event = await util.assertEvent(assetAuction, {
      event: 'Won',
      args: {_winner: accounts[2]},
    });

    // Initial bidder loses 20 token bid, but gains 89 tokens from winner.
    let account1Balance = await tokenContract.balanceOf(accounts[1]);
    assert(util.ether(100e3 + 109 - 20).equals(account1Balance));

    // Winner no longer has payment tokens, but has asset
    assert.equal(accounts[2], await assetOwnership.ownerOf(5));
    assert(
      util
        .ether(100e3 - 198)
        .equals(await tokenContract.balanceOf(accounts[2])),
    );

    // Winner can transfer
    await assetOwnership.transfer(accounts[4], 5, {from: accounts[2]});
    assert.equal(accounts[4], await assetOwnership.ownerOf(5));
  });

  it('replacement bid during auction', async function() {
    // Account 1 starts auction, auction contract owns minted asset.
    await assetAuction.bid(5, web3.toWei(20, 'ether'), {from: accounts[1]});
    assert.equal(assetAuction.address, await assetOwnership.ownerOf(5));
    let event = await util.assertEvent(
      assetAuction,
      {event: 'Created'},
      {_tokenId: 5, _startPrice: util.ether(200)},
    );

    util.mineBlocks(web3, 3);

    let currentPrice = await assetAuction.currentPrice(5);
    //console.log('Price after 15 blocks: ', currentPrice.toString());
    assert(util.ether(173.0).equals(currentPrice));

    // Account 2 bids less than enough to win outright.
    await assetAuction.bid(5, util.ether(150.0), {from: accounts[2]});

    // Auction contract still owns.
    assert.equal(assetAuction.address, await assetOwnership.ownerOf(5));

    // Initial bidder loses 20 token bid, but gains 85 tokens from out-bidder.
    let account1Balance = await tokenContract.balanceOf(accounts[1]); // advances 1 block
    assert(util.ether(100e3 + 85 - 20).equals(account1Balance));

    // New bidder no longer has payment tokens.
    assert(
      util
        .ether(100e3 - 150)
        .equals(await tokenContract.balanceOf(accounts[2])),
    );

    util.mineBlocks(web3, 1);
    currentPrice = await assetAuction.currentPrice(5);
    //console.log('Price after 5 blocks: ', currentPrice.toString());
    assert(util.ether(155.0).equals(currentPrice));
    assert.equal(assetAuction.address, await assetOwnership.ownerOf(5));

    util.mineBlocks(web3, 1);
    currentPrice = await assetAuction.currentPrice(5);
    //console.log('Price after 22 blocks: ', currentPrice.toString());
    assert(util.ether(146.0).equals(currentPrice));
    assert.equal(accounts[2], await assetOwnership.ownerOf(5));

    // Now bidding on this asset should fail for any amount
    util.expectRevert(
      assetAuction.bid(5, util.ether(400), {from: accounts[3]}),
    );
  });

  it('low outbid amount', async function() {
    // Account 1 starts auction, auction contract owns minted asset.
    await assetAuction.bid(5, web3.toWei(20, 'ether'), {from: accounts[1]});
    assert.equal(assetAuction.address, await assetOwnership.ownerOf(5));
    let event = await util.assertEvent(
      assetAuction,
      {event: 'Created'},
      {_tokenId: 5, _startPrice: util.ether(200)},
    );

    util.mineBlocks(web3, 3);

    let currentPrice = await assetAuction.currentPrice(5);
    //console.log('Price after 15 blocks: ', currentPrice.toString());
    assert(util.ether(173.0).equals(currentPrice));

    // Account 2 doesn't bid enough
    util.expectRevert(assetAuction.bid(5, util.ether(22), {from: accounts[2]}));

    // Auction contract still owns.
    assert.equal(assetAuction.address, await assetOwnership.ownerOf(5));
  });
});
