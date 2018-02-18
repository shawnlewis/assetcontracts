const util = require('./util');

var AssetAuction = artifacts.require('./AssetAuction.sol');

function curveValue(curveA, curveB, curveC, D, i) {
  if (i < 0 || i > D) {
    return null;
  }
  return curveA * i * i + curveB * i + curveC;
}

function curveParams(p0, pE, D, puMult) {
  var E = D - 1;
  var pPU = puMult * pE / 1000;
  var linearpPU = pE + (p0 - pE) / D;
  if (pPU > linearpPU) {
    pPU = linearpPU;
  }
  curveA = (pE - p0 + D * (p0 - pPU) / E) / D;
  curveB = (pPU - p0) / E - curveA * E;
  return [curveA, curveB];
}

function assertBasicallyEqual(numA, bigNumB) {
  function absFloor(num) {
    return num > 0 ? Math.floor(num) : Math.ceil(num);
  }
  assert(
    Math.abs(
      bigNumB
        .divToInt(1e15)
        .minus(absFloor(numA * 1e3))
        .toNumber(),
    ) <= 1.0,
    `${numA.toString()} not basically equal to ${bigNumB.toString()}`,
  );
}

async function checkCurve(
  assetAuction,
  startPrice,
  endPrice,
  duration,
  curveMult,
) {
  let startPriceBig = web3.toBigNumber(web3.toWei(startPrice, 'ether'));
  let endPriceBig = web3.toBigNumber(web3.toWei(endPrice, 'ether'));
  let [curveA, curveB] = await assetAuction.curveParams(
    startPriceBig,
    endPriceBig,
    duration,
    curveMult,
  );
  let [expCurveA, expCurveB] = curveParams(
    startPrice,
    endPrice,
    duration,
    curveMult,
  );
  //console.log('params', curveA.toString(), curveB.toString());
  assertBasicallyEqual(expCurveA, curveA);
  assertBasicallyEqual(expCurveB, curveB);

  async function checkValue(i, val) {
    let expVal = curveValue(expCurveA, expCurveB, startPrice, duration, i);
    let actVal = await assetAuction.curveValue(
      curveA,
      curveB,
      startPriceBig,
      duration,
      i,
    );
    assertBasicallyEqual(expVal, actVal);
    if (val) {
      assertBasicallyEqual(val, actVal);
    }
  }

  checkValue(0, startPrice);
  checkValue(duration, endPrice);
  checkValue(Math.floor(duration * 0.3));
}

contract('AuctionCurve', function(accounts) {
  var assetAuction;

  beforeEach('setup', async function() {
    assetAuction = await AssetAuction.new(0x0, 0x0);
  });

  it('curve params', async function() {
    checkCurve(assetAuction, 1000000, 10, 1000, 1500);
  });

  it('curve linear', async function() {
    checkCurve(assetAuction, 100, 10, 1000, 1500);
  });

  it('curve extreme', async function() {
    checkCurve(assetAuction, 1e9, 10, 10, 1010);
    checkCurve(assetAuction, 1e9, 10, 100000, 1010);
  });
});
