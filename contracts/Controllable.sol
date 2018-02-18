pragma solidity ^0.4.18;

/***
 * Like Ownable but takes another address, controller, passed
 * in via constructor.
 */
contract Controllable {
    address public controller;
    address public owner;

    function Controllable(address _controller) public {
        controller = _controller;
        owner = msg.sender;
    }

    modifier onlyController() {
        require(msg.sender == controller);
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function changeController(address newController) public onlyOwner {
        controller = newController;
    }

    function changeOwner(address newOwner) public onlyOwner {
        owner = newOwner;
    }
}
