// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender,address recipient,uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract RaceSwap_vulnerable {
    address public owner;
    uint256 public rate; // scaled by 1e18

    event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, string race);
    event RateUpdated(address indexed updater, uint256 newRate, string note);
    event SponsorPayoutExecuted(address indexed team, uint256 amount, string race);

    constructor(uint256 initialRate) {
        owner = msg.sender;
        rate = initialRate;
    }

    // Vulnerability: no onlyOwner
    function setRate(uint256 newRate, string calldata note) external {
        rate = newRate;
        emit RateUpdated(msg.sender, newRate, note);
    }

    // Sponsor payout (F1 use-case)
    function sponsorPayout(IERC20 token, address team, uint256 amount, string calldata race) external {
        require(token.transfer(team, amount), "transfer failed");
        emit SponsorPayoutExecuted(team, amount, race);
    }

    // Vulnerability: No slippage protection
    function swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, string calldata race) external returns (uint256 amountOut) {
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "transferFrom failed");
        amountOut = (amountIn * rate) / 1e18;
        require(tokenOut.transfer(msg.sender, amountOut), "transfer failed");
        emit SwapExecuted(msg.sender, address(tokenIn), address(tokenOut), amountIn, amountOut, race);
        return amountOut;
    }

    // Emergency withdraw (demo)
    function emergencyWithdraw(IERC20 token, address to, uint256 amount) external {
        require(token.transfer(to, amount), "transfer failed");
    }
}
