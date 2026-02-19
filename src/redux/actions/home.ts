export const GET_HOME_REQUEST = "GET_HOME_REQUEST";
export const GET_HOME_SUCCESS = "GET_HOME_SUCCESS";
export const GET_HOME_FAILURE = "GET_HOME_FAILURE";

export const getHomeRequest = () => ({ type: GET_HOME_REQUEST });
export const getHomeSuccess = (payload: any) => ({ type: GET_HOME_SUCCESS, payload });
export const getHomeFailure = (error: string) => ({ type: GET_HOME_FAILURE, error });
