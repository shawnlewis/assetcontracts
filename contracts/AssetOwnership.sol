pragma solidity ^0.4.18;

import './ERC721.sol';
import './Controllable.sol';
import './AssetMinter.sol';

contract AssetOwnership is ERC721, Controllable {
    string public constant name = "Chirp";
    string public constant symbol = "CHIRP";
    uint256 public totalSupply = 0;
    uint256[] public tokens;
    mapping (uint256 => address) tokenOwners;
    mapping (uint256 => address) tokenApprovals;
    mapping (uint256 => AssetMinter) tokenMinters;
    mapping (address => uint256) ownerTokenCounts;
    mapping (uint256 => string) comments;

    function AssetOwnership(address _controller) public Controllable(_controller) {
    }

    function _isMinting(uint256 _tokenId) internal view returns (bool) {
        AssetMinter minter = tokenMinters[_tokenId];
        if (minter == address(0x0)) {
            return false;
        }
        return minter.stillMinting(_tokenId);
    }

    function _owns(address _account, uint256 _tokenId) internal view returns (bool) {
        return tokenOwners[_tokenId] == _account;
    }

    function _transfer(address _from, address _to, uint256 _tokenId) internal {
        require(_owns(_from, _tokenId));
        ownerTokenCounts[_to]++;
        tokenOwners[_tokenId] = _to;
        if (_from != address(0)) {
            ownerTokenCounts[_from]--;
            // Clear pending approvals
            tokenApprovals[_tokenId] = 0;
        }
        Transfer(_from, _to, _tokenId);
    }

    function balanceOf(address _owner) public view returns (uint256) {
        // NOTE: This will be incorrect during minting, the user doesn't
        // actually own the token until minting is over.
        return ownerTokenCounts[_owner];
    }

    function ownerOf(uint256 _tokenId) public view returns (address) {
        if (_isMinting(_tokenId)) {
            return tokenMinters[_tokenId];
        }
        address owner = tokenOwners[_tokenId];
        // The spec says the following is required, but we don't do it's cleaner
        // use return values (over try/catch) on the client.
        //require(owner != address(0));
        return owner;
    }

    function approve(address _to, uint256 _tokenId) public {
        require(!_isMinting(_tokenId));
        require(_owns(msg.sender, _tokenId));
        tokenApprovals[_tokenId] = _to;
        Approval(msg.sender, _to, _tokenId);
    }

    function transferFrom(address _from, address _to, uint256 _tokenId) public {
        require(!_isMinting(_tokenId));
        require(tokenApprovals[_tokenId] == _to);
        _transfer(_from, _to, _tokenId);
    }

    function transfer(address _to, uint256 _tokenId) public {
        require(!_isMinting(_tokenId));
        _transfer(msg.sender, _to, _tokenId);
    }

    function tokensOfOwner(address _owner) external view returns(uint256[] ownerTokens) {
        // There may be zeroes at the end of this array, because balanceOf includes tokens for which
        // the user is the current high bidder during active auctions, but ownerOf doesn't count those.
        uint256 total = balanceOf(_owner);
        if (total == 0) {
            return new uint256[](0);
        } else {
            uint256[] memory result = new uint256[](total);
            uint256 resultIndex = 0;

            for (uint256 i; i < tokens.length; i++) {
                if (tokenOwners[tokens[i]] == _owner) {
                    result[resultIndex] = tokens[i];
                    resultIndex++;
                }
            }

            return result;
        }
    }

    function delayedMint(address _owner, uint256 _tokenId) public onlyController {
        _transfer(0, _owner, _tokenId);
        tokenMinters[_tokenId] = AssetMinter(msg.sender);
        totalSupply++;
        tokens.push(_tokenId);
    }

    function mint(address _owner, uint256 _tokenId) public onlyController {
        _transfer(0, _owner, _tokenId);
        totalSupply++;
        tokens.push(_tokenId);
    }

    function controllerTransfer(address _from, address _to, uint256 _value) public onlyController {
        _transfer(_from, _to, _value);
    }
}