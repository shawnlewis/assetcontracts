pragma solidity ^0.4.18;

import './ERC20.sol';

// Sells tokens for a fixed price, but limits tokens each address can buy.
// This doesn't prevent someone from buying all the tokens with a bunch of accounts,
// but it's probably annoying / costly enough when the tokens are of low value.

contract SellTokensFixedAddressLimit {
    ERC20 public tokenContract;
    uint256 public tokensPerEth;
    address owner;

    uint256 addressLimit;
    mapping (address => uint256) public used;

    function SellTokensFixedAddressLimit(address _tokenContract, uint256 _tokensPerEth, uint256 _addressLimit) public {
        owner = msg.sender;
        tokenContract = ERC20(_tokenContract);
        tokensPerEth = _tokensPerEth;
        addressLimit = _addressLimit;
    }

    function buy() payable public {
        require(msg.value > 0);
        uint256 tokens = msg.value * tokensPerEth;
        uint256 remaining = addressLimit - used[msg.sender];
        if (tokens > remaining) {
            tokens = remaining;
        }
        require(tokens > 0);

        used[msg.sender] += tokens;
        uint256 price = tokens / tokensPerEth;
        uint256 returnAmount = msg.value - price;
        tokenContract.transfer(msg.sender, tokens);
        owner.transfer(price);
        msg.sender.transfer(returnAmount);
    }
}
