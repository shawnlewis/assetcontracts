const util = require('./util');

var CHRPToken = artifacts.require('./CHRPToken.sol');
var AssetOwnership = artifacts.require('./AssetOwnership.sol');
var AssetAuction = artifacts.require('./AssetAuction.sol');

contract('Deploy', function(accounts) {
  it('setup', async function() {
    chrp = await CHRPToken.deployed();
    console.log('chrp address:', chrp.address);
    asset = await AssetOwnership.deployed();
    console.log('asset address:', asset.address);
    auction = await AssetAuction.deployed();
    console.log('auction address:', auction.address);
  });
});
