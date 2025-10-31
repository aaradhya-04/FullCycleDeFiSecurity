const RaceSwap = artifacts.require("RaceSwap_vulnerable");
const ERC20Mock = artifacts.require("ERC20Mock");
const { expect } = require('chai');

contract("RaceSwap_vulnerable", (accounts) => {
  const owner = accounts[0];
  const user = accounts[1];

  it("deploys and sets initial rate", async () => {
    const swap = await RaceSwap.deployed();
    const rate = await swap.rate();
    expect(rate.toString()).to.equal(web3.utils.toWei('2','ether'));
  });

  it("performs a swap (mock token) when approved", async () => {
    const token = await ERC20Mock.deployed();
    const swap = await RaceSwap.deployed();

    // mint to user and approve
    await token.mint(user, web3.utils.toWei('100', 'ether'), { from: owner });
    await token.approve(swap.address, web3.utils.toWei('50', 'ether'), { from: user });

    const res = await swap.swap(token.address, token.address, web3.utils.toWei('10', 'ether'), "Monaco2025", { from: user });
    const ev = res.logs.find(l => l.event === 'SwapExecuted');
    expect(ev).to.not.be.undefined;
    expect(ev.args.amountIn.toString()).to.equal(web3.utils.toWei('10','ether'));
  });
});
