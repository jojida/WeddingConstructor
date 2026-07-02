"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const invites_1 = __importDefault(require("./routes/invites"));
const upload_1 = __importDefault(require("./routes/upload"));
const payment_1 = __importDefault(require("./routes/payment"));
const rsvp_1 = __importDefault(require("./routes/rsvp"));
const guests_1 = __importDefault(require("./routes/guests"));
const telegram_1 = __importDefault(require("./routes/telegram"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Serve uploaded files
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/invites', invites_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/payment', payment_1.default);
app.use('/api/rsvp', rsvp_1.default);
app.use('/api/guests', guests_1.default);
app.use('/api/telegram', telegram_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`🚀 Wedding Constructor API running on http://localhost:${PORT}`);
});
