# CHRP Coin

## Solidity Contracts

The overall goal of this set of contracts is to sell a new ERC721 (nonfungible) token, using an auction system.

There are 3 major contracts:

* CHRPToken: An ERC20 token, used to bid in auctions
* AssetOwnership: The ERC721 NFT.
* AssetAuction: The auction system for the NFTs.

Users can bid on any unowned NFT at any time to start an auction for that NFT. A declining auction starts and
runs for a given number of blocks. Anyone can win the auction at any time by outbidding the current price.

Users can also bid less than the current price (but higher than the previous bid by some margin) to replace
the current bidder.

When someone is outbid they are compensated with some of the overage. The remaining amounts go to various fees.

All bidding is done with an ERC20 token, not ETH.

The auction curve is a 2nd order polynomial, defined by the first point (start price), last point (end price),
and second to last point, which we force to a fixed multiple of the end price. If the second to last value
would cause the curve to be super-linear we force it to linear.

One thing that might seem odd at first is the delayedMint logic in AssetOwnership. When the auction contract
mints a new NFT, the NFT marks the auction contract as its "minter". The stillMinting function on the auction
contract returns true until the auction has completed. The idea is that the NFT is not transferrable until
the auction has ended. This accounts for the situation where someone bids on an auction, and then no one else
bids. When the auction ends, the token is automatically owned and transferrable by the original bidder, without
requiring a second transaction.

I'd also like a review for SellTokensFixedAddressLimit, which sells ERC20 tokens for a fixed price, but limits
amount sold per address.

## Running tests

Tests don't work in ganace-cli 6.1.0 because it's not consistent about how many blocks are mined, and
we need fine-grained control of that. So for tests use the version in truffle.

```bash
truffle develop
test
```
