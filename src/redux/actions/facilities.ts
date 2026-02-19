export const GET_FACILITIES_REQUEST = "GET_FACILITIES_REQUEST";
export const GET_FACILITIES_SUCCESS = "GET_FACILITIES_SUCCESS";
export const GET_FACILITIES_FAILURE = "GET_FACILITIES_FAILURE";

export const getFacilitiesRequest = () => ({ type: GET_FACILITIES_REQUEST });
export const getFacilitiesSuccess = (payload: any[]) => ({ type: GET_FACILITIES_SUCCESS, payload });
export const getFacilitiesFailure = (error: string) => ({ type: GET_FACILITIES_FAILURE, error });
