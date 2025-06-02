# Contributing to Orphi CrowdFund

Thank you for considering contributing to the Orphi CrowdFund project! This document outlines the process for contributing to the project.

## Development Process

1. **Fork the Repository**: Start by forking the repository to your GitHub account.

2. **Clone Your Fork**: Clone your fork to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/OrphiCrowdFund.git
   cd OrphiCrowdFund
   ```

3. **Install Dependencies**: Install the required dependencies:
   ```bash
   npm install
   ```

4. **Set Up Environment**: Create a `.env` file based on the `.env.example` template:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your local development settings.

5. **Create a Branch**: Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

6. **Make Changes**: Implement your changes, adhering to the code style guidelines.

7. **Run Tests**: Ensure that all tests pass with your changes:
   ```bash
   npx hardhat test
   ```

8. **Run Security Checks**: Make sure your changes don't introduce security vulnerabilities:
   ```bash
   npx hardhat run scripts/simple-security-audit.js
   ```

9. **Submit a Pull Request**: Push your changes to your fork and submit a pull request to the main repository.

## Security Guidelines

- **Never commit private keys or secrets**
- Never introduce direct calls to `selfdestruct` or similar dangerous operations
- Always use SafeERC20 for token transfers
- Follow the Checks-Effects-Interactions pattern
- Add comprehensive tests for new functionality

## Pull Request Guidelines

- Include a clear description of the changes
- Link any related issues
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass
- Make sure the code follows the project's style guidelines

## Code Style Guidelines

- Use 4 spaces for indentation
- Follow the Solidity style guide
- Add NatSpec comments for all public functions
- Use meaningful variable and function names
- Keep functions focused and short

## Review Process

Pull requests will be reviewed by the project maintainers. The review process may include:

1. Code review
2. Test verification
3. Security assessment
4. Documentation review

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.
