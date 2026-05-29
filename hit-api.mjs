
async function main() {
    console.log("Logging into Render API...");
    const loginRes = await fetch("https://inventory-hub-itdv.onrender.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@inventorypro.com", password: "admin123" })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
        console.error("Login failed:", loginData);
        return;
    }

    const cookie = loginRes.headers.get("set-cookie");
    const token = loginData.token;
    console.log("Logged in successfully.");

    console.log("Fetching Sales Report...");
    const reportRes = await fetch("https://inventory-hub-itdv.onrender.com/api/reports/sales", {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Cookie": cookie || ""
        }
    });

    const reportData = await reportRes.json();
    if (!reportRes.ok) {
        console.error("Report failed:", reportData);
        return;
    }

    console.log("Report Summary:", reportData.summary);
    console.log("Last 3 Invoices:", reportData.invoices.slice(0, 3));
    console.log("Dashboard sales equivalent (saleDate == '2026-05-28'):", reportData.invoices.filter(i => i.saleDate === '2026-05-28').length);
}

main().catch(console.error);
