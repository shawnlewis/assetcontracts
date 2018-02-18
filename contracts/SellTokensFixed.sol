pragma solidity ^0.4.18;


import './ERC20.sol';

contract SellTokensFixed {
    ERC20 public tokenContract;
    uint256 public tokensPerEth;
    address owner;

    function SellTokensFixed(address _tokenContract, uint256 _tokensPerEth) public {
        owner = msg.sender;
        tokenContract = ERC20(_tokenContract);
        tokensPerEth = _tokensPerEth;
    }

    function buy() payable public {
        tokenContract.transfer(msg.sender, msg.value * tokensPerEth);
        owner.transfer(msg.value);
    }
}
