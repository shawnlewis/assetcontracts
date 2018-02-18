const util = require('./util');

var CHRPToken = artifacts.require('./CHRPToken.sol');

contract('Coin', function(accounts) {
  it('initial conditions', async function() {
    let coin = await CHRPToken.new(accounts[1]);
    assert.equal(accounts[1], await coin.controller());
    assert(util.ether(100e6).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(100e6).equals(await coin.totalSupply()));
  });

  it('transfer', async function() {
    let coin = await CHRPToken.new(accounts[1]);

    util.expectRevert(coin.transfer(accounts[3], 5, {from: accounts[2]}));
    await coin.transfer(accounts[3], util.ether(5), {from: accounts[1]});
    assert(util.ether(100e6 - 5).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(5).equals(await coin.balanceOf(accounts[3])));

    // Try to transfer just barely too much.
    util.expectRevert(
      coin.transfer(accounts[3], util.ether(100e6 - 5).plus(1), {
        from: accounts[1],
      }),
    );

    await coin.transfer(accounts[3], util.ether(100e6 - 5), {
      from: accounts[1],
    });

    assert(util.ether(0).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(100e6).equals(await coin.balanceOf(accounts[3])));
  });

  it('allow', async function() {
    let coin = await CHRPToken.new(accounts[1]);

    // Nothing allowed yet
    util.expectRevert(
      coin.transferFrom(accounts[1], accounts[2], util.ether(5), {
        from: accounts[1],
      }),
    );

    await coin.approve(accounts[3], util.ether(5), {from: accounts[1]});
    assert(
      util.ether(5).equals(await coin.allowance(accounts[1], accounts[3])),
    );
    // spender can't transfer one too many
    util.expectRevert(
      coin.transferFrom(accounts[1], accounts[2], util.ether(5).plus(1), {
        from: accounts[3],
      }),
    );
    // but can transfer the exact amount
    await coin.transferFrom(accounts[1], accounts[2], util.ether(5), {
      from: accounts[3],
    });
    // allowance now zero
    assert(
      util.ether(0).equals(await coin.allowance(accounts[1], accounts[3])),
    );
    // Nothing left to transfer
    util.expectRevert(
      coin.transferFrom(accounts[1], accounts[2], 1, {
        from: accounts[3],
      }),
    );

    assert(util.ether(100e6 - 5).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(5).equals(await coin.balanceOf(accounts[2])));
    assert(util.ether(0).equals(await coin.balanceOf(accounts[3])));
  });

  it('controller transfer', async function() {
    let coin = await CHRPToken.new(accounts[1]);

    // Non-controller can't transfer
    util.expectRevert(
      coin.controllerTransfer(accounts[1], accounts[2], util.ether(5), {
        from: accounts[2],
      }),
    );

    // Controller can transfer from anyone to anyone
    await coin.controllerTransfer(accounts[1], accounts[2], util.ether(5), {
      from: accounts[1],
    });
    await coin.controllerTransfer(accounts[2], accounts[3], util.ether(2), {
      from: accounts[1],
    });
    assert(util.ether(100e6 - 5).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(3).equals(await coin.balanceOf(accounts[2])));
    assert(util.ether(2).equals(await coin.balanceOf(accounts[3])));

    // Controller can't transfer too much
    util.expectRevert(
      coin.controllerTransfer(accounts[3], accounts[4], util.ether(2).plus(1), {
        from: accounts[1],
      }),
    );

    // But can transfer exact amount
    await coin.controllerTransfer(accounts[3], accounts[4], util.ether(2), {
      from: accounts[1],
    });
    assert(util.ether(0).equals(await coin.balanceOf(accounts[3])));
    assert(util.ether(2).equals(await coin.balanceOf(accounts[4])));
  });

  it('controller burn', async function() {
    let coin = await CHRPToken.new(accounts[1]);

    // Non-controller can't burn
    util.expectRevert(
      coin.controllerBurn(accounts[1], util.ether(5), {
        from: accounts[2],
      }),
    );

    await coin.controllerBurn(accounts[1], util.ether(5), {
      from: accounts[1],
    });
    assert(util.ether(100e6 - 5).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(100e6 - 5).equals(await coin.totalSupply()));

    await coin.transfer(accounts[3], util.ether(6), {from: accounts[1]});
    await coin.controllerBurn(accounts[3], util.ether(2), {
      from: accounts[1],
    });
    assert(util.ether(100e6 - 11).equals(await coin.balanceOf(accounts[1])));
    assert(util.ether(4).equals(await coin.balanceOf(accounts[3])));
    assert(util.ether(100e6 - 7).equals(await coin.totalSupply()));
  });
});
