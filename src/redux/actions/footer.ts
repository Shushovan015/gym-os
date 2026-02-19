export const GET_FOOTER_REQUEST = "GET_FOOTER_REQUEST";
export const GET_FOOTER_SUCCESS = "GET_FOOTER_SUCCESS";
export const GET_FOOTER_FAILURE = "GET_FOOTER_FAILURE";

export const getFooterRequest = () => ({ type: GET_FOOTER_REQUEST });
export const getFooterSuccess = (payload: any) => ({ type: GET_FOOTER_SUCCESS, payload });
export const getFooterFailure = (error: string) => ({ type: GET_FOOTER_FAILURE, error });
