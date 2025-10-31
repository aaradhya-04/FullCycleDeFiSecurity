// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract F1StockMarket {
    address public hostAccount;
    address public owner;
    
    struct TeamStock {
        string teamName;
        uint256 price; // in wei
        uint256 totalSupply;
        uint256 circulatingSupply;
        mapping(address => uint256) balances;
    }
    
    mapping(string => TeamStock) public teams;
    string[] public teamNames;
    
    event StockBought(address indexed buyer, string indexed team, uint256 amount, uint256 totalCost);
    event StockSold(address indexed seller, string indexed team, uint256 amount, uint256 totalValue);
    event PriceUpdated(string indexed team, uint256 newPrice);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor(address _hostAccount) {
        hostAccount = _hostAccount;
        owner = msg.sender;
        
        // Initialize F1 teams
        _initializeTeams();
    }
    
    function _initializeTeams() private {
        teamNames = ["Mercedes", "Red Bull", "Ferrari", "McLaren", "Aston Martin", "Alpine", "AlphaTauri", "Haas", "Alfa Romeo", "Williams"];
        
        for(uint i = 0; i < teamNames.length; i++) {
            teams[teamNames[i]].teamName = teamNames[i];
            teams[teamNames[i]].price = 0.1 ether;
            teams[teamNames[i]].totalSupply = 10000;
            teams[teamNames[i]].circulatingSupply = 0;
        }
    }
    
    function buyStock(string memory teamName) external payable {
        require(msg.value >= teams[teamName].price, "Insufficient payment");
        require(teams[teamName].circulatingSupply < teams[teamName].totalSupply, "No stocks available");
        
        uint256 stockAmount = msg.value / teams[teamName].price;
        require(stockAmount > 0, "Amount too low");
        
        if(teams[teamName].circulatingSupply + stockAmount > teams[teamName].totalSupply) {
            stockAmount = teams[teamName].totalSupply - teams[teamName].circulatingSupply;
        }
        
        uint256 totalCost = stockAmount * teams[teamName].price;
        uint256 refund = msg.value - totalCost;
        
        teams[teamName].balances[msg.sender] += stockAmount;
        teams[teamName].circulatingSupply += stockAmount;
        
        // Send ether to host account
        payable(hostAccount).transfer(totalCost);
        
        // Refund excess
        if(refund > 0) {
            payable(msg.sender).transfer(refund);
        }
        
        emit StockBought(msg.sender, teamName, stockAmount, totalCost);
    }
    
    function sellStock(string memory teamName, uint256 amount) external {
        require(teams[teamName].balances[msg.sender] >= amount, "Insufficient stocks");
        
        uint256 totalValue = amount * teams[teamName].price;
        require(address(this).balance >= totalValue, "Insufficient contract balance");
        
        teams[teamName].balances[msg.sender] -= amount;
        teams[teamName].circulatingSupply -= amount;
        
        // Transfer ether from host account (requires host to fund contract)
        payable(msg.sender).transfer(totalValue);
        
        emit StockSold(msg.sender, teamName, amount, totalValue);
    }
    
    function updatePrice(string memory teamName, uint256 newPrice) external onlyOwner {
        teams[teamName].price = newPrice;
        emit PriceUpdated(teamName, newPrice);
    }
    
    function getBalance(address user, string memory teamName) external view returns (uint256) {
        return teams[teamName].balances[user];
    }
    
    function getPrice(string memory teamName) external view returns (uint256) {
        return teams[teamName].price;
    }
    
    function getTeamInfo(string memory teamName) external view returns (
        string memory,
        uint256,
        uint256,
        uint256
    ) {
        return (
            teams[teamName].teamName,
            teams[teamName].price,
            teams[teamName].totalSupply,
            teams[teamName].circulatingSupply
        );
    }
    
    function getAllTeams() external view returns (string[] memory) {
        return teamNames;
    }
    
    // Allow host account to fund contract for selling
    receive() external payable {
        // Accept deposits
    }
    
    function fundContract() external payable {
        // Allow anyone to fund (for demo purposes)
    }
}

