var CHRPToken = artifacts.require('./CHRPToken.sol');
var AssetOwnership = artifacts.require('./AssetOwnership.sol');
var AssetAuction = artifacts.require('./AssetAuction.sol');
const util = require('../test/util.js');

module.exports = async function(deployer) {
  deployer
    // deploy Token
    .deploy(CHRPToken, web3.eth.accounts[0])
    // deploy AssetOwnership
    .then(() => {
      return deployer.deploy(AssetOwnership, web3.eth.accounts[0]);
    })
    // deploy Auction
    .then(() => {
      return deployer.deploy(
        AssetAuction,
        AssetOwnership.address,
        CHRPToken.address,
        util.ether(10, web3),
        util.ether(100, web3),
        20,
        1010,
        10,
        10,
        1500,
        1500,
        100,
        500,
      );
    })
    // Change owner of token to auction
    .then(() => CHRPToken.deployed())
    .then(tokenInstance => tokenInstance.changeController(AssetAuction.address))
    // Change owner of asset to auction
    .then(() => AssetOwnership.deployed())
    .then(assetInstance => assetInstance.changeController(AssetAuction.address))
    .then(() => console.log('done'));
};
