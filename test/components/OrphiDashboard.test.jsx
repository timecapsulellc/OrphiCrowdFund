import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrphiDashboard from '../../docs/components/OrphiDashboard';

/**
 * OrphiDashboard Component Test Suite
 * 
 * These tests verify that the OrphiDashboard component renders 
 * and functions correctly in both demo and live modes.
 */

describe('OrphiDashboard', () => {
  // Demo mode tests
  describe('Demo Mode', () => {
    beforeEach(() => {
      render(<OrphiDashboard demoMode={true} />);
    });

    test('renders dashboard header', () => {
      expect(screen.getByText('OrphiChain')).toBeInTheDocument();
      expect(screen.getByText('CrowdFund Live Dashboard')).toBeInTheDocument();
    });

    test('displays metrics with demo data', () => {
      expect(screen.getByText('Total Members')).toBeInTheDocument();
      expect(screen.getByText('Total Volume')).toBeInTheDocument();
      expect(screen.getByText('Daily Registrations')).toBeInTheDocument();
      expect(screen.getByText('Daily Withdrawals')).toBeInTheDocument();
    });

    test('shows demo alert', () => {
      expect(screen.getByText('Demo mode active - showing sample data')).toBeInTheDocument();
    });

    test('chart containers are rendered', () => {
      expect(screen.getByText('Pool Balances Distribution')).toBeInTheDocument();
      expect(screen.getByText('Recent Registration Activity')).toBeInTheDocument();
    });

    test('genealogy tree is rendered', () => {
      expect(screen.getByText('Network Genealogy Tree')).toBeInTheDocument();
    });

    test('activity panels are rendered', () => {
      expect(screen.getByText('Recent Registrations')).toBeInTheDocument();
      expect(screen.getByText('Recent Withdrawals')).toBeInTheDocument();
    });

    test('tree controls are functional', () => {
      const expandButton = screen.getByText('Expand Tree');
      fireEvent.click(expandButton);
      expect(screen.getByText('Collapse Tree')).toBeInTheDocument();
    });

    test('exports panel is rendered', () => {
      expect(screen.getByText('OrphiChain Dashboard Report')).toBeInTheDocument();
    });
  });

  // Live mode tests would require mocking the contract and provider
  // This is a simplified example - in a real test you would need to mock ethers.js
  describe('Live Mode', () => {
    test('attempts to connect to contract when address and provider given', async () => {
      const mockProvider = {
        getSigner: jest.fn().mockReturnValue({
          getAddress: jest.fn().mockResolvedValue('0x123')
        })
      };
      
      const mockContract = {
        totalMembers: jest.fn().mockResolvedValue(100),
        totalVolume: jest.fn().mockResolvedValue(5000),
        getPoolBalances: jest.fn().mockResolvedValue([1000, 500, 500, 500, 1500]),
        on: jest.fn(),
        removeAllListeners: jest.fn()
      };
      
      // Mock ethers.Contract constructor
      jest.mock('ethers', () => ({
        Contract: jest.fn().mockImplementation(() => mockContract),
        formatEther: jest.fn().mockImplementation(val => String(val))
      }));
      
      render(
        <OrphiDashboard 
          contractAddress="0x123456789abcdef" 
          provider={mockProvider} 
        />
      );
      
      // Wait for async contract initialization
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });
  });
});
