import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import FindId from "./pages/FindId";
import FindPw from "./pages/FindPw";
import MainLayout from "./components/MainLayout";
import OfficeTalk from "./pages/OfficeTalk";
import Records from "./pages/Records";
import MultiDevice from "./pages/MultiDevice";
import MyDesk from "./pages/MyDesk";
import Board from "./pages/Board";
import Mode from "./pages/Mode";
import ProtectedRoute from "./components/ProtectedRoute";
import PointSystem from "./userspage/PointSystem";
import PointPopup from "./userspage/PointPopup";
import PointDevice from "./userspage/PointDevice";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/find-id" element={<FindId />} />
          <Route path="/find-pw" element={<FindPw />} />
          <Route path="/point-popup" element={<PointPopup />} /> {/* Independent Route */}
          <Route path="/point-device" element={<PointDevice />} /> {/* Independent Route */}

          <Route
            path="/main"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OfficeTalk />} /> {/* Default to OfficeTalk or Dashboard */}
            <Route path="office-talk" element={<OfficeTalk />} />
            <Route path="records" element={<Records />} />
            <Route path="multi-device" element={<MultiDevice />} />
            <Route path="mydesk" element={<MyDesk />} />
            <Route path="board" element={<Board />} />
            <Route path="docs" element={<Board />} /> {/* Redirect/Map Docs to Board */}
            <Route path="point" element={<PointSystem />} />
            <Route path="mode" element={<Mode />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
