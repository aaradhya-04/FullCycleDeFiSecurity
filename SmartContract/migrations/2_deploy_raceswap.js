const RaceSwap = artifacts.require("RaceSwap_vulnerable");
const ERC20Mock = artifacts.require("ERC20Mock");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(ERC20Mock, web3.utils.toWei('1000000', 'ether'));
  const mock = await ERC20Mock.deployed();

  const initialRate = web3.utils.toWei('2', 'ether');
  await deployer.deploy(RaceSwap, initialRate);
  const raceswap = await RaceSwap.deployed();

  // Fund RaceSwap with mock tokens for swaps/payouts
  await mock.transfer(raceswap.address, web3.utils.toWei('10000','ether'));
};
