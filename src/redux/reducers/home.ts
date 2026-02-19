import { GET_HOME_REQUEST, GET_HOME_SUCCESS, GET_HOME_FAILURE } from "@src/redux/actions/home";

const initialState = {
  content: null as any,
  status: [] as any[],
  points: [] as any[],
  loading: false,
  error: null as string | null,
};

export default function home(state = initialState, action: any) {
  switch (action.type) {
    case GET_HOME_REQUEST:
      return { ...state, loading: true, error: null };
    case GET_HOME_SUCCESS:
      return {
        ...state,
        loading: false,
        content: action.payload?.content ?? null,
        status: action.payload?.status ?? [],
        points: action.payload?.points ?? [],
      };
    case GET_HOME_FAILURE:
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}
