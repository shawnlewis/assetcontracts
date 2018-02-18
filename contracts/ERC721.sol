pragma solidity ^0.4.18;

contract ERC721 {
    //function totalSupply() public view returns (uint256 supply);
    function balanceOf(address _owner) public view returns (uint256);
    function ownerOf(uint256 _tokenId) public view returns (address);
    function approve(address _to, uint256 _tokenId) public;
    function transferFrom(address _from, address _to, uint256 _tokenId) public;
    function transfer(address _to, uint256 _tokenId) public;

    // optional
    //function name() public constant returns (string);
    //function symbol() constant returns (string symbol);
    // NOTE: ERC721 Currently specifies tokensOfOwnerByIndex, but tokensOfOwner is implemented instead
    //     in the linked example, and it seems to be more useful anyway.
    //function tokensOfOwner(address _owner) constant returns (uint tokenId);
    //function tokenMetadata(uint256 _tokenId) constant returns (string infoUrl);

    event Transfer(address indexed _from, address indexed _to, uint256 _tokenId);
    event Approval(address indexed _owner, address indexed _approved, uint256 _tokenId);
}