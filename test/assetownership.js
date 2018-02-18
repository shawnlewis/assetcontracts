const util = require('./util');

var AssetOwnership = artifacts.require('./AssetOwnership.sol');

contract('AssetOwnership', function(accounts) {
  it('check controller address set', async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);
    assert.equal(accounts[0], await assetOwnership.controller());
  });

  it('token mintable', async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);

    assert.equal(0, await assetOwnership.balanceOf(accounts[1]));
    assert.equal(0, await assetOwnership.balanceOf(accounts[2]));
    assert.equal(0, await assetOwnership.balanceOf(accounts[3]));

    await assetOwnership.mint(accounts[1], 5, {from: accounts[0]});
    await assetOwnership.mint(accounts[1], 6, {from: accounts[0]});
    await assetOwnership.mint(accounts[2], 7, {from: accounts[0]});
    await assetOwnership.mint(accounts[3], 8, {from: accounts[0]});

    assert.equal(4, await assetOwnership.totalSupply());

    assert.equal(2, await assetOwnership.balanceOf(accounts[1]));
    assert.equal(accounts[1], await assetOwnership.ownerOf(5));
    assert.equal(accounts[1], await assetOwnership.ownerOf(6));
    assert.equal(1, await assetOwnership.balanceOf(accounts[2]));
    assert.equal(accounts[2], await assetOwnership.ownerOf(7));
    assert.equal(1, await assetOwnership.balanceOf(accounts[3]));
    assert.equal(accounts[3], await assetOwnership.ownerOf(8));

    let a1Tokens = await assetOwnership.tokensOfOwner(accounts[1]);
    assert.equal(2, a1Tokens.length);
    assert(a1Tokens[0].equals(5));
    assert(a1Tokens[1].equals(6));
    let a2Tokens = await assetOwnership.tokensOfOwner(accounts[2]);
    assert.equal(1, a2Tokens.length);
    assert(a2Tokens[0].equals(7));
    let a3Tokens = await assetOwnership.tokensOfOwner(accounts[3]);
    assert.equal(1, a3Tokens.length);
    assert(a3Tokens[0].equals(8));

    await util.expectRevert(assetOwnership.ownerOf(9));
  });

  it('only controller can mint', async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);
    await util.expectRevert(
      assetOwnership.mint(accounts[1], 6, {from: accounts[1]}),
    );
  });

  it("can't mint owned token", async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);

    await assetOwnership.mint(accounts[1], 5, {from: accounts[0]});
    await util.expectRevert(
      assetOwnership.mint(accounts[1], 5, {from: accounts[0]}),
    );
    assert.equal(1, await assetOwnership.totalSupply());
  });

  it('token transferable by owner', async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);
    await assetOwnership.mint(accounts[1], 5, {from: accounts[0]});
    assert.equal(accounts[1], await assetOwnership.ownerOf(5));
    assert.equal(1, await assetOwnership.balanceOf(accounts[1]));

    await assetOwnership.transfer(accounts[2], 5, {from: accounts[1]});
    assert.equal(accounts[2], await assetOwnership.ownerOf(5));
    let event = await util.assertEvent(assetOwnership, {
      event: 'Transfer',
      args: {_from: accounts[1], _to: accounts[2]},
    });
    assert.equal(5, event.args._tokenId);
    assert.equal(0, await assetOwnership.balanceOf(accounts[1]));
    assert.equal(1, await assetOwnership.balanceOf(accounts[2]));
  });

  it('token not transferable by non-owner', async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);
    await assetOwnership.mint(accounts[1], 5, {from: accounts[0]});
    await util.expectRevert(
      assetOwnership.transfer(accounts[2], 5, {from: accounts[2]}),
    );
    assert.equal(1, await assetOwnership.balanceOf(accounts[1]));
    assert.equal(0, await assetOwnership.balanceOf(accounts[2]));
  });

  it('approve transferFrom works', async function() {
    let assetOwnership = await AssetOwnership.new(accounts[0]);
    await assetOwnership.mint(accounts[1], 5, {from: accounts[0]});
    await assetOwnership.approve(accounts[2], 5, {from: accounts[1]});
    let event = await util.assertEvent(assetOwnership, {
      event: 'Approval',
      args: {_owner: accounts[1], _approved: accounts[2]},
    });
    assert.equal(5, event.args._tokenId);
    await assetOwnership.transferFrom(accounts[1], accounts[2], 5, {
      from: accounts[4],
    });
  });
});
