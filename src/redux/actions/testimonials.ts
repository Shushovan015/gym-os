export const GET_TESTIMONIALS_REQUEST = "GET_TESTIMONIALS_REQUEST";
export const GET_TESTIMONIALS_SUCCESS = "GET_TESTIMONIALS_SUCCESS";
export const GET_TESTIMONIALS_FAILURE = "GET_TESTIMONIALS_FAILURE";

export const getTestimonialsRequest = () => ({ type: GET_TESTIMONIALS_REQUEST });
export const getTestimonialsSuccess = (payload: any[]) => ({ type: GET_TESTIMONIALS_SUCCESS, payload });
export const getTestimonialsFailure = (error: string) => ({ type: GET_TESTIMONIALS_FAILURE, error });
