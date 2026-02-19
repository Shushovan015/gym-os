export const GET_TRAINERS_REQUEST = "GET_TRAINERS_REQUEST";
export const GET_TRAINERS_SUCCESS = "GET_TRAINERS_SUCCESS";
export const GET_TRAINERS_FAILURE = "GET_TRAINERS_FAILURE";

export const getTrainersRequest = () => ({ type: GET_TRAINERS_REQUEST });
export const getTrainersSuccess = (payload: any[]) => ({ type: GET_TRAINERS_SUCCESS, payload });
export const getTrainersFailure = (error: string) => ({ type: GET_TRAINERS_FAILURE, error });
