import "./globals.css";

export const metadata = {
  title: "金盲杖",
  description: "面向盲人和低视力用户的物品寻找与 NFC 物品信息网站",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
