// FormValidation.jsx - Robust input validation with real-time feedback
import React, { useState, useEffect } from 'react';
import './OrphiChainEnhanced.css';

/**
 * OrphiChain Brand-Compliant Form Validation Component
 * 
 * Features:
 * - Real-time validation as user types
 * - Support for multiple validation rules
 * - Custom validation messages
 * - Field-level error states
 * - Styled with OrphiChain brand guidelines
 * - Accessibility support
 */

// Default validation rules
const defaultValidators = {
  required: {
    validate: value => value.trim() !== '',
    message: 'This field is required'
  },
  ethereum: {
    validate: value => /^0x[a-fA-F0-9]{40}$/.test(value),
    message: 'Must be a valid Ethereum address (0x...)'
  },
  minLength: {
    validate: (value, min) => value.length >= min,
    message: (min) => `Must be at least ${min} characters`
  },
  maxLength: {
    validate: (value, max) => value.length <= max,
    message: (max) => `Must be no more than ${max} characters`
  },
  number: {
    validate: value => !isNaN(Number(value)),
    message: 'Must be a valid number'
  },
  min: {
    validate: (value, min) => Number(value) >= min,
    message: (min) => `Must be at least ${min}`
  },
  max: {
    validate: (value, max) => Number(value) <= max,
    message: (max) => `Must be no more than ${max}`
  },
  pattern: {
    validate: (value, pattern) => new RegExp(pattern).test(value),
    message: 'Invalid format'
  },
  custom: {
    validate: (value, validator) => validator(value),
    message: 'Invalid value'
  }
};

const FormInput = ({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  validators = {},
  customMessages = {},
  validateOnChange = true,
  validateOnBlur = true,
  errorState = {},
  setErrorState,
  required = false,
  disabled = false,
  className = '',
  autoComplete = 'off',
  ...props
}) => {
  const [touched, setTouched] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [isValid, setIsValid] = useState(null);
  
  // Validate the input value
  const validateInput = (inputValue) => {
    // Skip validation if not required and empty
    if (!validators.required && !required && inputValue === '') {
      setIsValid(true);
      setValidationMessage('');
      if (setErrorState) {
        setErrorState(prev => ({
          ...prev,
          [name]: {
            isValid: true,
            message: ''
          }
        }));
      }
      return true;
    }
    
    // Check each validator
    for (const [rule, config] of Object.entries(validators)) {
      if (defaultValidators[rule]) {
        const validator = defaultValidators[rule];
        let param;
        
        if (typeof config === 'object' && config !== null) {
          param = config.param;
        } else if (rule !== 'required' && rule !== 'ethereum' && rule !== 'number') {
          param = config;
        }
        
        const isValidInput = validator.validate(inputValue, param);
        
        if (!isValidInput) {
          const message = customMessages[rule] || 
            (typeof validator.message === 'function' 
              ? validator.message(param) 
              : validator.message);
          
          setIsValid(false);
          setValidationMessage(message);
          
          if (setErrorState) {
            setErrorState(prev => ({
              ...prev,
              [name]: {
                isValid: false,
                message
              }
            }));
          }
          
          return false;
        }
      }
    }
    
    // If all validations pass
    setIsValid(true);
    setValidationMessage('');
    
    if (setErrorState) {
      setErrorState(prev => ({
        ...prev,
        [name]: {
          isValid: true,
          message: ''
        }
      }));
    }
    
    return true;
  };
  
  // Handle input change
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(e);
    
    if (validateOnChange && touched) {
      validateInput(newValue);
    }
  };
  
  // Handle input blur
  const handleBlur = (e) => {
    setTouched(true);
    
    if (validateOnBlur) {
      validateInput(e.target.value);
    }
    
    if (onBlur) {
      onBlur(e);
    }
  };
  
  // Sync with external error state
  useEffect(() => {
    if (errorState[name] !== undefined) {
      setIsValid(errorState[name].isValid);
      setValidationMessage(errorState[name].message);
    }
  }, [errorState, name]);
  
  return (
    <div className="orphi-form-group">
      {label && (
        <label 
          htmlFor={id || name} 
          className="orphi-form-label"
        >
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      
      <input
        id={id || name}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`orphi-form-input ${isValid === true ? 'is-valid' : ''} ${isValid === false ? 'is-invalid' : ''} ${className}`}
        aria-invalid={isValid === false}
        aria-describedby={isValid === false ? `${name}-error` : undefined}
        autoComplete={autoComplete}
        required={required}
        {...props}
      />
      
      {touched && validationMessage && (
        <div 
          id={`${name}-error`}
          className="orphi-form-feedback invalid"
          role="alert"
        >
          {validationMessage}
        </div>
      )}
      
      {touched && isValid && validators.required && (
        <div className="orphi-form-feedback valid">
          ✓
        </div>
      )}
    </div>
  );
};

// Form wrapper component
const Form = ({
  children,
  onSubmit,
  validateOnSubmit = true,
  className = '',
  ...props
}) => {
  const [errorState, setErrorState] = useState({});
  
  // Validate all form fields
  const validateForm = () => {
    let isFormValid = true;
    
    React.Children.forEach(children, child => {
      if (child.type === FormInput || (child.props && child.props.validators)) {
        const isFieldValid = child.props.validateInput 
          ? child.props.validateInput(child.props.value)
          : true;
        
        if (!isFieldValid) {
          isFormValid = false;
        }
      }
    });
    
    return isFormValid;
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateOnSubmit && !validateForm()) {
      return;
    }
    
    if (onSubmit) {
      onSubmit(e);
    }
  };
  
  // Clone children to add error state
  const formChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && (child.type === FormInput || (child.props && child.props.validators))) {
      return React.cloneElement(child, {
        errorState,
        setErrorState
      });
    }
    return child;
  });
  
  return (
    <form
      onSubmit={handleSubmit}
      className={`orphi-form ${className}`}
      noValidate
      {...props}
    >
      {formChildren}
    </form>
  );
};

export { Form, FormInput, defaultValidators };
