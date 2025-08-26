// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockSystemContract
 * @dev Mock implementation of ZetaChain SystemContract for testing
 */
contract MockSystemContract {
    mapping(address => uint256) public balances;

    event MockDeposit(address indexed user, uint256 amount);
    event MockWithdraw(address indexed user, uint256 amount);

    function deposit(address user, uint256 amount) external {
        balances[user] += amount;
        emit MockDeposit(user, amount);
    }

    function withdraw(address user, uint256 amount) external {
        require(balances[user] >= amount, "Insufficient balance");
        balances[user] -= amount;
        emit MockWithdraw(user, amount);
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}
