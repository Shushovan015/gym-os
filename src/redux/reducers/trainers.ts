import {
  GET_TRAINERS_REQUEST,
  GET_TRAINERS_SUCCESS,
  GET_TRAINERS_FAILURE,
} from "@src/redux/actions/trainers";

const initialState = {
  items: [],
  ptContent: null as any,
  plans: [],
  loading: false,
  error: null as string | null,
};

export default function trainersReducer(state = initialState, action: any) {
  switch (action.type) {
    case GET_TRAINERS_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_TRAINERS_SUCCESS:
      return {
        ...state,
        loading: false,
        items: action.payload?.trainers ?? [],
        ptContent: action.payload?.ptContent ?? null,
        plans: action.payload?.plans ?? [],
      };
    case GET_TRAINERS_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
