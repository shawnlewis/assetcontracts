const util = require('./util');

var CHRPToken = artifacts.require('./CHRPToken.sol');
var SellTokens = artifacts.require('./SellTokensFixedAddressLimit.sol');

contract('SellTokensFixedAddressLimit', function(accounts) {
  var tokenContract;
  var sellContract;

  beforeEach('setup', async function() {
    tokenContract = await CHRPToken.new(accounts[0]);
    sellContract = await SellTokens.new(
      tokenContract.address,
      1000000,
      util.ether(1000),
    );

    // Accounts 1-3 start with 100k CHRP tokens.
    await tokenContract.transfer(
      sellContract.address,
      web3.toWei(100e3, 'ether'),
      {
        from: accounts[0],
      },
    );
  });

  it('buy tokens', async function() {
    await sellContract.buy({
      value: web3.toWei(0.0005, 'ether'),
      from: accounts[1],
      gas: 400000,
    });
    assert(util.ether(500).equals(await tokenContract.balanceOf(accounts[1])));
    await sellContract.buy({
      value: web3.toWei(1, 'ether'),
      from: accounts[1],
      gas: 400000,
    });
    assert(util.ether(1000).equals(await tokenContract.balanceOf(accounts[1])));
    util.expectRevert(
      sellContract.buy({
        value: web3.toWei(0.0005, 'ether'),
        from: accounts[1],
        gas: 400000,
      }),
    );
  });
});
