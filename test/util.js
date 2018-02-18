BigNumber = require('bignumber.js');

exports.assertEvent = function(contract, filter, check) {
  return new Promise((resolve, reject) => {
    var event = contract[filter.event]();
    event.watch();
    event.get((error, logs) => {
      var log = _.filter(logs, filter);
      if (log.length == 0) {
        throw Error('Failed to find filtered event for ' + filter.event);
      } else if (log.length == 1) {
        let event = log[0];
        if (check) {
          for (var key of Object.keys(check)) {
            let expVal = check[key];
            if (typeof expVal === 'number') {
              expVal = new BigNumber(expVal);
            }
            let actVal = event.args[key];
            // Shitty test to see if BigNumber
            if (!_.isNil(expVal.s)) {
              if (!expVal.equals(actVal)) {
                throw Error(
                  `Event BigNumber key didn't match ${
                    filter.event
                  }, ${key}, ${expVal}, ${actVal}`,
                );
              }
            } else {
              if (expVal !== actVal) {
                throw Error(
                  `Event key didn't match ${
                    filter.event
                  }, ${key}, ${expVal}, ${actVal}`,
                );
              }
            }
          }
        }
        resolve(event);
      } else {
        throw Error('Found more than one event for ' + filter.event);
      }
    });
    event.stopWatching();
  });
};

// OpenZeppelin
exports.expectThrow = async function(promise) {
  try {
    await promise;
  } catch (error) {
    // TODO: Check jump destination to destinguish between a throw
    //       and an actual invalid jump.
    const invalidJump = error.message.search('invalid JUMP') >= 0;
    // TODO: When we contract A calls contract B, and B throws, instead
    //       of an 'invalid jump', we get an 'out of gas' error. How do
    //       we distinguish this from an actual out of gas event? (The
    //       testrpc log actually show an 'invalid jump' event.)
    const outOfGas = error.message.search('out of gas') >= 0;
    assert(
      invalidJump || outOfGas,
      "Expected throw, got '" + error + "' instead",
    );
    return;
  }
  assert.fail('Expected throw not received');
};

exports.expectRevert = async function(promise) {
  try {
    await promise;
  } catch (error) {
    assert.isAbove(
      error.message.search('revert'),
      -1,
      'Error containing "revert" must be returned',
    );
  }
};

exports.mineBlocks = function(web3, nBlocks) {
  for (var i = 0; i < nBlocks; i++) {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: 0,
    });
  }
};

exports.ether = function(val, _web3) {
  if (_web3) {
    web3 = _web3;
  }
  return web3.toBigNumber(web3.toWei(val, 'ether'));
};
