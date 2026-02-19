export const GET_CONTACT_REQUEST = "GET_CONTACT_REQUEST";
export const GET_CONTACT_SUCCESS = "GET_CONTACT_SUCCESS";
export const GET_CONTACT_FAILURE = "GET_CONTACT_FAILURE";

export const getContactRequest = () => ({ type: GET_CONTACT_REQUEST });
export const getContactSuccess = (payload: any) => ({ type: GET_CONTACT_SUCCESS, payload });
export const getContactFailure = (error: string) => ({ type: GET_CONTACT_FAILURE, error });
