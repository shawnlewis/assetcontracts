pragma solidity ^0.4.18;

import "./ERC20.sol";
import "./Controllable.sol";

contract CHRPToken is ERC20, Controllable {
    event Burn(uint256 _amount);

    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;

    uint256 constant MAX_UINT256 = 2**256 - 1;

    string public name = "Chrip Token";
    string public symbol = "CHRP";
    uint8 public decimals = 18;
    uint256 public totalSupply = 100000000 * uint256(10)**decimals;  // 100 million

    function CHRPToken(address initialOwner) public Controllable(initialOwner) {
        balances[initialOwner] = totalSupply;
    }

    function _transfer(address _from, address _to, uint256 _value) internal {
        require(balances[_from] >= _value);
        balances[_from] -= _value;
        balances[_to] += _value;
        Transfer(_from, _to, _value);
    }

    function transfer(address _to, uint256 _value) public returns (bool success) {
        _transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        uint256 allowance = allowed[_from][msg.sender];
        require(allowance >= _value);
        _transfer(_from, _to, _value);
        allowed[_from][msg.sender] -= _value;
        return true;
    }

    function balanceOf(address _owner) view public returns (uint256 balance) {
        return balances[_owner];
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) view public returns (uint256 remaining) {
      return allowed[_owner][_spender];
    }

    function controllerTransfer(address _from, address _to, uint256 _value) public onlyController {
        _transfer(_from, _to, _value);
    }

    function controllerBurn(address account, uint256 _amount) public onlyController {
        require(balances[account] >= _amount);
        balances[account] -= _amount;
        totalSupply -= _amount;
        Burn(_amount);
    }
}