// SmartInputValidation.jsx - Real-time input validation and user guidance
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import './SmartInputValidation.css';

/**
 * SmartInputValidation - Production-ready input validation with real-time feedback
 * 
 * Features:
 * - Real-time validation with debouncing
 * - Smart error messages and suggestions
 * - Accessibility support (ARIA, screen readers)
 * - Mobile-responsive design
 * - Auto-formatting for addresses, amounts
 * - Integration with form libraries
 * - Custom validation rules
 * - User guidance and tooltips
 */

const VALIDATION_TYPES = {
  ETHEREUM_ADDRESS: 'ethereum_address',
  AMOUNT: 'amount',
  EMAIL: 'email',
  REQUIRED: 'required',
  MIN_LENGTH: 'min_length',
  MAX_LENGTH: 'max_length',
  PATTERN: 'pattern',
  CUSTOM: 'custom'
};

const SmartInputValidation = ({
  type = 'text',
  value = '',
  onChange,
  onValidationChange,
  validationRules = [],
  placeholder = '',
  label = '',
  helpText = '',
  disabled = false,
  required = false,
  autoComplete = 'off',
  debounceMs = 300,
  showValidationIcon = true,
  showSuggestions = true,
  className = '',
  id,
  name,
  'aria-describedby': ariaDescribedBy,
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [validationState, setValidationState] = useState({
    isValid: true,
    isValidating: false,
    errors: [],
    warnings: [],
    suggestions: []
  });
  const [isFocused, setIsFocused] = useState(false);
  const [hasBeenTouched, setHasBeenTouched] = useState(false);
  
  const inputRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const validationIdRef = useRef(0);

  // Built-in validation rules
  const builtInValidators = {
    [VALIDATION_TYPES.REQUIRED]: (val) => ({
      isValid: val.trim().length > 0,
      message: 'This field is required',
      type: 'error'
    }),
    
    [VALIDATION_TYPES.ETHEREUM_ADDRESS]: (val) => {
      if (!val) return { isValid: true };
      
      try {
        const address = ethers.getAddress(val);
        const isValid = ethers.isAddress(address);
        
        return {
          isValid,
          message: isValid ? 'Valid Ethereum address' : 'Invalid Ethereum address format',
          type: isValid ? 'success' : 'error',
          suggestions: isValid ? [] : [
            'Ensure the address starts with 0x',
            'Check that all characters are valid hexadecimal',
            'Verify the address is 42 characters long'
          ]
        };
      } catch (error) {
        return {
          isValid: false,
          message: 'Invalid Ethereum address format',
          type: 'error',
          suggestions: [
            'Paste a valid Ethereum address',
            'Address should be 42 characters starting with 0x'
          ]
        };
      }
    },

    [VALIDATION_TYPES.AMOUNT]: (val, options = {}) => {
      if (!val) return { isValid: true };
      
      const numValue = parseFloat(val);
      const { min = 0, max = Infinity, decimals = 18 } = options;
      
      if (isNaN(numValue)) {
        return {
          isValid: false,
          message: 'Please enter a valid number',
          type: 'error'
        };
      }
      
      if (numValue < min) {
        return {
          isValid: false,
          message: `Minimum amount is ${min}`,
          type: 'error'
        };
      }
      
      if (numValue > max) {
        return {
          isValid: false,
          message: `Maximum amount is ${max}`,
          type: 'error'
        };
      }
      
      // Check decimal places
      const decimalPlaces = (val.split('.')[1] || '').length;
      if (decimalPlaces > decimals) {
        return {
          isValid: false,
          message: `Maximum ${decimals} decimal places allowed`,
          type: 'error',
          suggestions: [`Round to ${decimals} decimal places`]
        };
      }
      
      return {
        isValid: true,
        message: 'Valid amount',
        type: 'success'
      };
    },

    [VALIDATION_TYPES.EMAIL]: (val) => {
      if (!val) return { isValid: true };
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(val);
      
      return {
        isValid,
        message: isValid ? 'Valid email address' : 'Invalid email format',
        type: isValid ? 'success' : 'error',
        suggestions: isValid ? [] : [
          'Include @ symbol',
          'Add domain extension (.com, .org, etc.)'
        ]
      };
    },

    [VALIDATION_TYPES.MIN_LENGTH]: (val, options = {}) => {
      const { minLength = 0 } = options;
      const isValid = val.length >= minLength;
      
      return {
        isValid,
        message: isValid ? '' : `Minimum ${minLength} characters required`,
        type: isValid ? 'success' : 'error'
      };
    },

    [VALIDATION_TYPES.MAX_LENGTH]: (val, options = {}) => {
      const { maxLength = Infinity } = options;
      const isValid = val.length <= maxLength;
      
      return {
        isValid,
        message: isValid ? '' : `Maximum ${maxLength} characters allowed`,
        type: isValid ? 'success' : 'error'
      };
    },

    [VALIDATION_TYPES.PATTERN]: (val, options = {}) => {
      if (!val) return { isValid: true };
      
      const { pattern, message = 'Invalid format' } = options;
      const regex = new RegExp(pattern);
      const isValid = regex.test(val);
      
      return {
        isValid,
        message: isValid ? '' : message,
        type: isValid ? 'success' : 'error'
      };
    }
  };

  // Auto-formatting functions
  const formatValue = useCallback((rawValue, inputType) => {
    switch (inputType) {
      case 'ethereum_address':
        // Auto-add 0x prefix if missing
        if (rawValue && !rawValue.startsWith('0x') && rawValue.length > 0) {
          return '0x' + rawValue;
        }
        return rawValue;
        
      case 'amount':
        // Remove non-numeric characters except decimal point
        return rawValue.replace(/[^0-9.]/g, '');
        
      default:
        return rawValue;
    }
  }, []);

  // Perform validation
  const validateValue = useCallback(async (val) => {
    const validationId = ++validationIdRef.current;
    
    setValidationState(prev => ({ ...prev, isValidating: true }));
    
    const results = {
      errors: [],
      warnings: [],
      suggestions: [],
      isValid: true
    };

    // Apply built-in validations
    if (required) {
      const requiredResult = builtInValidators[VALIDATION_TYPES.REQUIRED](val);
      if (!requiredResult.isValid) {
        results.errors.push(requiredResult);
        results.isValid = false;
      }
    }

    // Apply custom validation rules
    for (const rule of validationRules) {
      try {
        let result;
        
        if (typeof rule === 'function') {
          result = await rule(val);
        } else if (typeof rule === 'object') {
          const { type, options, validator } = rule;
          
          if (validator && typeof validator === 'function') {
            result = await validator(val);
          } else if (builtInValidators[type]) {
            result = builtInValidators[type](val, options);
          }
        }
        
        if (result) {
          if (result.type === 'error') {
            results.errors.push(result);
            results.isValid = false;
          } else if (result.type === 'warning') {
            results.warnings.push(result);
          }
          
          if (result.suggestions) {
            results.suggestions.push(...result.suggestions);
          }
        }
      } catch (error) {
        console.error('Validation error:', error);
        results.errors.push({
          message: 'Validation failed',
          type: 'error'
        });
        results.isValid = false;
      }
    }

    // Only update if this is the latest validation
    if (validationId === validationIdRef.current) {
      setValidationState({
        ...results,
        isValidating: false
      });
      
      onValidationChange?.({
        isValid: results.isValid,
        errors: results.errors,
        warnings: results.warnings,
        value: val
      });
    }
  }, [validationRules, required, onValidationChange]);

  // Debounced validation
  const debouncedValidate = useCallback((val) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      validateValue(val);
    }, debounceMs);
  }, [validateValue, debounceMs]);

  // Handle input change
  const handleChange = useCallback((event) => {
    const rawValue = event.target.value;
    const formattedValue = formatValue(rawValue, type);
    
    setInternalValue(formattedValue);
    onChange?.(formattedValue);
    
    if (hasBeenTouched) {
      debouncedValidate(formattedValue);
    }
  }, [onChange, formatValue, type, hasBeenTouched, debouncedValidate]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setHasBeenTouched(true);
    
    // Immediate validation on blur
    validateValue(internalValue);
  }, [internalValue, validateValue]);

  // Auto-complete suggestions
  const getAutoCompleteSuggestions = useCallback(() => {
    if (type === 'ethereum_address' && internalValue.length > 10) {
      // Suggest common address formats or recent addresses
      return [
        'Check if this is a valid Ethereum address',
        'Ensure the address is from a trusted source'
      ];
    }
    
    return [];
  }, [type, internalValue]);

  // Effect to sync external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Effect to validate on mount if value exists
  useEffect(() => {
    if (internalValue) {
      validateValue(internalValue);
    }
  }, []); // Only run on mount

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Generate IDs for accessibility
  const inputId = id || `smart-input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const suggestionsId = `${inputId}-suggestions`;

  // Determine validation status
  const hasErrors = validationState.errors.length > 0;
  const hasWarnings = validationState.warnings.length > 0;
  const isValidating = validationState.isValidating;

  const inputClassName = [
    'smart-input',
    className,
    hasErrors ? 'has-error' : '',
    hasWarnings ? 'has-warning' : '',
    validationState.isValid && hasBeenTouched ? 'is-valid' : '',
    isValidating ? 'is-validating' : '',
    isFocused ? 'is-focused' : '',
    disabled ? 'is-disabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className="smart-input-container">
      {/* Label */}
      {label && (
        <label htmlFor={inputId} className="smart-input-label">
          {label}
          {required && <span className="required-indicator" aria-label="required">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="smart-input-wrapper">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type={type === 'ethereum_address' ? 'text' : type}
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          className={inputClassName}
          aria-invalid={hasErrors}
          aria-describedby={[
            hasErrors ? errorId : null,
            helpText ? helpId : null,
            ariaDescribedBy
          ].filter(Boolean).join(' ')}
          {...props}
        />

        {/* Validation icon */}
        {showValidationIcon && hasBeenTouched && (
          <div className="validation-icon">
            {isValidating && <span className="spinner" aria-label="Validating">⏳</span>}
            {!isValidating && validationState.isValid && <span className="success-icon" aria-label="Valid">✅</span>}
            {!isValidating && hasErrors && <span className="error-icon" aria-label="Invalid">❌</span>}
            {!isValidating && hasWarnings && <span className="warning-icon" aria-label="Warning">⚠️</span>}
          </div>
        )}
      </div>

      {/* Help text */}
      {helpText && (
        <div id={helpId} className="smart-input-help">
          {helpText}
        </div>
      )}

      {/* Error messages */}
      {hasErrors && hasBeenTouched && (
        <div id={errorId} className="smart-input-errors" role="alert">
          {validationState.errors.map((error, index) => (
            <div key={index} className="error-message">
              {error.message}
            </div>
          ))}
        </div>
      )}

      {/* Warning messages */}
      {hasWarnings && hasBeenTouched && (
        <div className="smart-input-warnings">
          {validationState.warnings.map((warning, index) => (
            <div key={index} className="warning-message">
              {warning.message}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && (validationState.suggestions.length > 0 || getAutoCompleteSuggestions().length > 0) && hasBeenTouched && (
        <div id={suggestionsId} className="smart-input-suggestions">
          {validationState.suggestions.map((suggestion, index) => (
            <div key={index} className="suggestion-item">
              💡 {suggestion}
            </div>
          ))}
          {getAutoCompleteSuggestions().map((suggestion, index) => (
            <div key={`auto-${index}`} className="suggestion-item">
              💡 {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartInputValidation;
