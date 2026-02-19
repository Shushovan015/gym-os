export const GET_PROSHOP_REQUEST = "GET_PROSHOP_REQUEST";
export const GET_PROSHOP_SUCCESS = "GET_PROSHOP_SUCCESS";
export const GET_PROSHOP_FAILURE = "GET_PROSHOP_FAILURE";

export const getProShopRequest = () => ({ type: GET_PROSHOP_REQUEST });
export const getProShopSuccess = (payload: any[]) => ({ type: GET_PROSHOP_SUCCESS, payload });
export const getProShopFailure = (error: string) => ({ type: GET_PROSHOP_FAILURE, error });
