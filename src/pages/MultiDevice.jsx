import { useState, useEffect } from "react";

export default function MultiDevice() {
    const [htmlCode, setHtmlCode] = useState("");
    const [popupWindow, setPopupWindow] = useState(null);

    useEffect(() => {
        // Basic template loading
        fetch("/src/pages/basic-page.html") // Assuming vite serves src, or we might need to move to public
            .then((res) => {
                if (res.ok) return res.text();
                return "<h1>Model - CODEBRIDGE</h1><p>Failed to load template.</p>";
            })
            .then((text) => setHtmlCode(text))
            .catch(() => setHtmlCode("<h1>Default</h1>"));
    }, []);

    const openWindow = () => {
        const newWindow = window.open("", "Model - CODEBRIDGE", "width=800,height=600");
        if (newWindow) {
            newWindow.document.write(htmlCode);
            newWindow.document.close();
            setPopupWindow(newWindow);
        }
    };

    const updatePreview = () => {
        if (popupWindow && !popupWindow.closed) {
            popupWindow.document.body.innerHTML = ""; // Clear
            popupWindow.document.write(htmlCode);
            popupWindow.document.close();
        } else {
            alert("팝업창이 닫혀있거나 열리지 않았습니다.");
        }
    };

    const templates = [
        { label: "기본값 (Basic)", url: "/src/pages/basic-page.html" },
        { label: "로그인 폼 (Login)", code: "<h1>Login</h1><input placeholder='ID'><br><input type='password' placeholder='PW'><br><button>Login</button>" },
        { label: "대시보드 (Dashboard)", code: "<div style='display:flex'><div style='width:200px;background:#eee;height:100vh'>Menu</div><div style='padding:20px'><h1>Dashboard</h1><p>Content...</p></div></div>" }
    ];

    const loadTemplate = (tmpl) => {
        if (tmpl.url) {
            fetch(tmpl.url)
                .then(res => res.text())
                .then(text => setHtmlCode(text))
                .catch(() => alert("템플릿 로드 실패"));
        } else {
            setHtmlCode(tmpl.code);
        }
    };

    const closeWindow = () => {
        if (popupWindow && !popupWindow.closed) {
            popupWindow.document.body.innerHTML = `
        <div style="background:black; color:white; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
            <h1>TERMINATED</h1>
            <button onclick="window.close()" style="margin-top:20px; padding:10px 20px; cursor:pointer; border:1px solid white; background:transparent; color:white;">Close Completely</button>
        </div>
        <style>body { margin: 0; background: black; }</style>
      `;
        }
    };

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🖥️ 멀티디바이스 모드</h2>

            <div className="flex-1 flex gap-6">
                {/* Editor Area */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">HTML Source</span>
                            <select onChange={(e) => loadTemplate(templates[e.target.value])} className="text-xs border rounded p-1">
                                <option value="">템플릿 선택...</option>
                                {templates.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={openWindow} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-500">
                                멀티창 열기
                            </button>
                            <button onClick={updatePreview} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-500">
                                부르기 (Update)
                            </button>
                            <button onClick={closeWindow} className="bg-black text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-800">
                                종료
                            </button>
                        </div>
                    </div>
                    <textarea
                        className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none text-gray-900"
                        value={htmlCode}
                        onChange={(e) => setHtmlCode(e.target.value)}
                        spellCheck="false"
                    />
                </div>

                {/* Preview Area (In-app) */}
                <div className="hidden lg:flex w-1/3 flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <span className="font-semibold text-gray-700">Local Preview</span>
                    </div>
                    <iframe
                        srcDoc={htmlCode}
                        className="flex-1 w-full border-none"
                        title="Preview"
                    />
                </div>
            </div>
        </div>
    );
}
