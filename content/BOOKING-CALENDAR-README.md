# UMI SUSHI — 预约日期管理（test-v3）

需要调整营业日时，只修改同目录的 `booking-calendar.json`，无需修改 JavaScript。

编辑地址：https://github.com/umisushipeniche/umi-sushi-site/edit/test-v3/content/booking-calendar.json

默认配置：

```json
{
  "closed_weekdays": [1],
  "open_dates": [],
  "closed_dates": []
}
```

- `closed_weekdays`：每周固定休息日。0=星期日，1=星期一，2=星期二，3=星期三，4=星期四，5=星期五，6=星期六。目前 `[1]` 表示每周一休息。
- `open_dates`：**特殊营业**日期（即使遇到固定休息的星期一，也可以预约）。
- `closed_dates`：**临时休息**日期（即使原本正常营业，也禁止预约）。
- 日期格式必须是 `YYYY-MM-DD`，如 `2026-12-07`。
- 如同一天同时存在于 `open_dates` 和 `closed_dates`，**休息优先**，防止误接单。
- 以上只控制预约日期，**不会自动修改官网营业时间文案或 Google Maps 营业时间**；发生调整还需要单独更新这些信息。
- 预约目前经由 WhatsApp 提交申请，仍需店家确认；不是实时库存管理系统。

## 示例：某个星期一营业，下一天星期二调休

```json
{
  "closed_weekdays": [1],
  "open_dates": ["2026-12-07"],
  "closed_dates": ["2026-12-08"]
}
```

操作流程：
1. 打开上面的 GitHub 链接，确认左上角为 `test-v3`。
2. 点击铅笔图标编辑，填入需要开放或关闭的具体日期，保留英文双引号、逗号和中括号。
3. 点击 `Commit changes` 保存。
4. 打开测试版首页预约区域，刷新页面，验证两个日期。
5. 不要在未经确认时将此规则同步到 `main`。

安全说明：若预约日历配置无法加载，网站将禁用可选择的预约时间，避免意外接受休息日预约。
