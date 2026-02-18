import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import dashboardActions from "@Actions/dashboard";
import type { RootState } from "@Reducers/index";

export default function Dashboard() {
    const dispatch = useDispatch();
    const { status, data, error, filter } = useSelector(
        (s: RootState) => s.dashboard
    );

    useEffect(() => {
        dispatch(dashboardActions.getDashboardRequest({}));
    }, [dispatch]);

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>

            <div className="mt-4 space-y-2">
                <div>Status: {status}</div>
                <div>Filter: {filter}</div>

                {error && <div className="text-red-600">{error}</div>}
                {data && (
                    <pre className="bg-gray-100 p-3 rounded">{JSON.stringify(data, null, 2)}</pre>
                )}
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    className="px-3 py-2 rounded bg-black text-white"
                    onClick={() =>
                        dispatch(dashboardActions.setDashboardFilter({ filter: "monthly" }))
                    }
                >
                    Set filter monthly
                </button>
            </div>
        </div>
    );
}
