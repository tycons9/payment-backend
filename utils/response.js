const successResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

const errorResponse = (message, error = null) => {
  return {
    success: false,
    message,
    error: error?.message || error,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  successResponse,
  errorResponse
};