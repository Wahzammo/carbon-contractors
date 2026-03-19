// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationStake
 * @notice Workers stake USDC as a trust signal. Staked amount feeds into
 *         the platform's computed reputation score. Stakes are slashed on
 *         disputes resolved against the worker.
 *
 * @dev Stake lifecycle:
 *   - stake(amount): lock USDC, minimum $20 on first deposit
 *   - unstake(amount): withdraw after 7-day cooldown, must stay >= MIN or go to 0
 *   - slash(worker, amount): owner-only, triggered on dispute resolution
 */
contract ReputationStake is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    uint256 public minStake = 20_000_000; // 20 USDC (6 decimals)
    uint256 public constant COOLDOWN = 7 days;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 slashedTotal;
    }

    /// @notice worker address → stake info
    mapping(address => StakeInfo) public stakes;

    /// @notice Running total of USDC staked across all workers
    uint256 public totalStaked;

    // ── Events ──────────────────────────────────────────────────────────────────

    event Staked(address indexed worker, uint256 amount, uint256 newTotal);
    event Unstaked(address indexed worker, uint256 amount, uint256 remaining);
    event Slashed(address indexed worker, uint256 amount, uint256 remaining);
    event MinStakeUpdated(uint256 oldMin, uint256 newMin);

    // ── Errors ──────────────────────────────────────────────────────────────────

    error ZeroAmount();
    error BelowMinimumStake();
    error CooldownNotElapsed(uint256 readyAt);
    error InsufficientStake();
    error InvalidUnstakeAmount();

    // ── Constructor ─────────────────────────────────────────────────────────────

    /**
     * @param _usdc Address of the USDC token contract on Base.
     */
    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // ── Core operations ─────────────────────────────────────────────────────────

    /**
     * @notice Stake USDC as a reputation signal.
     *         First stake must be >= minStake. Top-ups can be any amount
     *         as long as total stays >= minStake.
     * @param amount USDC amount to stake (6 decimals)
     */
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        StakeInfo storage info = stakes[msg.sender];
        uint256 newTotal = info.amount + amount;

        if (newTotal < minStake) revert BelowMinimumStake();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        info.amount = newTotal;
        info.stakedAt = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount, newTotal);
    }

    /**
     * @notice Withdraw staked USDC after the cooldown period.
     *         Resulting balance must be either 0 or >= minStake.
     * @param amount USDC amount to unstake (6 decimals)
     */
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        StakeInfo storage info = stakes[msg.sender];
        if (amount > info.amount) revert InsufficientStake();

        uint256 readyAt = info.stakedAt + COOLDOWN;
        if (block.timestamp < readyAt) revert CooldownNotElapsed(readyAt);

        uint256 remaining = info.amount - amount;
        if (remaining > 0 && remaining < minStake) {
            revert InvalidUnstakeAmount();
        }

        info.amount = remaining;
        totalStaked -= amount;

        usdc.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, remaining);
    }

    /**
     * @notice Slash a worker's stake on dispute resolution.
     *         Slashed USDC is sent to the platform owner (treasury).
     *         If amount exceeds stake, slashes whatever remains.
     * @param worker Address of the worker to slash
     * @param amount USDC amount to slash (6 decimals)
     */
    function slash(address worker, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();

        StakeInfo storage info = stakes[worker];
        uint256 actual = amount > info.amount ? info.amount : amount;

        if (actual == 0) revert InsufficientStake();

        info.amount -= actual;
        info.slashedTotal += actual;
        totalStaked -= actual;

        usdc.safeTransfer(owner(), actual);

        emit Slashed(worker, actual, info.amount);
    }

    // ── Admin ───────────────────────────────────────────────────────────────────

    /**
     * @notice Update the minimum stake amount.
     * @param newMin New minimum stake in USDC (6 decimals)
     */
    function setMinStake(uint256 newMin) external onlyOwner {
        if (newMin == 0) revert ZeroAmount();
        uint256 oldMin = minStake;
        minStake = newMin;
        emit MinStakeUpdated(oldMin, newMin);
    }

    // ── View helpers ────────────────────────────────────────────────────────────

    /**
     * @notice Read a worker's full stake info.
     */
    function getStake(address worker)
        external
        view
        returns (uint256 amount, uint256 stakedAt, uint256 slashedTotal)
    {
        StakeInfo memory info = stakes[worker];
        return (info.amount, info.stakedAt, info.slashedTotal);
    }
}
