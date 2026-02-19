export const GET_PRICING_REQUEST = "GET_PRICING_REQUEST";
export const GET_PRICING_SUCCESS = "GET_PRICING_SUCCESS";
export const GET_PRICING_FAILURE = "GET_PRICING_FAILURE";

export const getPricingRequest = () => ({ type: GET_PRICING_REQUEST });
export const getPricingSuccess = (payload: any[]) => ({ type: GET_PRICING_SUCCESS, payload });
export const getPricingFailure = (error: string) => ({ type: GET_PRICING_FAILURE, error });
