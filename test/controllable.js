const util = require('./util');

var CHRPToken = artifacts.require('./CHRPToken.sol');
var AssetOwnership = artifacts.require('./AssetOwnership.sol');
var AssetAuction = artifacts.require('./AssetAuction.sol');

contract('Controllable', function(accounts) {
  var tokenContract;
  var assetOwnership;
  var assetAuction;

  it('controllable', async function() {
    tokenContract = await CHRPToken.new(accounts[1]);
    assert.equal(accounts[0], await tokenContract.owner());
    assert.equal(accounts[1], await tokenContract.controller());

    // Controller can do onlyController stuff, but owner can't
    await tokenContract.controllerBurn(accounts[1], 10, {from: accounts[1]});
    util.expectRevert(
      tokenContract.controllerBurn(accounts[1], 10, {from: accounts[0]}),
    );

    // Controller can't change controller
    util.expectRevert(
      tokenContract.changeController(accounts[2], {from: accounts[1]}),
    );
    // owner can
    await tokenContract.changeController(accounts[2], {from: accounts[0]});

    // New controller can burn
    await tokenContract.controllerBurn(accounts[1], 10, {from: accounts[2]});
    // old can't
    util.expectRevert(
      tokenContract.controllerBurn(accounts[1], 10, {from: accounts[1]}),
    );

    // Other accounts can't change owner
    util.expectRevert(
      tokenContract.changeOwner(accounts[3], {from: accounts[4]}),
    );
    // But owner can
    await tokenContract.changeOwner(accounts[3], {from: accounts[0]});

    assert.equal(accounts[3], await tokenContract.owner());
    assert.equal(accounts[2], await tokenContract.controller());
  });
});
