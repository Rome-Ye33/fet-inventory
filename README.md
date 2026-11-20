# 库存管理 · FET AUTO Inventory

FET AUTO 车辆进出库和库存的网页版，代替原来的 Excel「2026销售库存流水」。数据在 Supabase 项目「FET AUTO Inventory」（ueyriasnprqtqgvmkjwc），网页放在 GitHub Pages。界面有中文和英文。

## 功能

- **概览**：在库总数（乘用车、重型车辆）、本月入库和销售、待核实的车、各位置在库、最近的流水
- **录入**（管理员、录入员）：和 Excel Dashboard 一样分四块
  - 入库：车架号、类别、品牌、品名、型号、颜色、位置、报关状态；产品编码自动生成（类别 + 品牌 + 品名 + 颜色一样就是同一个编码，没有的按 FETV / FETH / FETO 顺延）；新的品牌、品名、型号、颜色自动加进下拉选项
  - 销售、调拨：车架号输后几位就能找到车，看到车在哪、还在不在库
  - 作废：按车架号或流水号找到流水作废，要写原因；作废入库会把这台车之后的销售、调拨一起作废
- **车辆查询**：按状态、类别、位置、品牌、型号、报关状态筛选（选了品牌，型号下拉只列这个品牌的），点车架号看详情和出入库记录，可以改型号、报关状态、备注、待核实说明
- **库存报表**：乘用车 / 重型车辆 / 其他 / 按位置，单价（美元）和金额，可以按型号筛
- **流水**：按日期、操作、状态、类别、型号、位置筛选
- **基础资料**：位置、下拉选项、产品与单价
- **用户与权限**（管理员）：邀请、改角色、停用、重设密码、删除注册错的账号

每个列表都能导出 Excel。

## 账号

- 角色：管理员（全部功能和用户管理）、录入员（录入和改基础资料）、只读（只能看）
- 管理员在「用户与权限」里把邮箱加进邀请名单，对方打开网站在「第一次使用」里用这个邮箱设置密码就能用，不发确认邮件
- 不在邀请名单上的人就算注册了也是停用状态，看不到数据，要管理员开通
- 忘记密码找管理员重设

注册、重设密码、删除账号走 Supabase Edge Function `account`（`supabase/functions/account/index.ts`，部署时 verify_jwt 关掉，函数里自己校验管理员）。

## 数据

数据库的表、视图和函数都在 Supabase 上（不在这个仓库里），主要的：

- `vehicles`：一台车一行（车架号唯一）；`excluded` 是不计库存的车（导入时核对不上的），`review_note` 是待核实说明
- `movements`：流水，INBOUND / SOLD / TRANSFER，ACTIVE / VOID
- `products`：产品编码和单价；`locations`：位置；`catalog_options`：下拉选项
- 视图 `vehicle_stock`（每台车的库存和当前位置）、`stock_report`、`stock_by_location`、`movement_log`
- 写数据都通过函数：`submit_inbound`、`submit_sale`、`submit_transfer`、`void_movement`、`update_vehicle` 等，只有启用中的管理员、录入员能调用；读数据要是启用中的用户（RLS）

改了表、视图或函数以后重新生成 `src/lib/database.types.ts`。

## 开发

```bash
npm install
npm run dev          # 本地运行
npm run build        # 类型检查 + 打包
npm run lint
npm run i18n:check   # 检查界面文字有没有漏了英文
```

Supabase 的地址和 publishable key 写在 `src/lib/supabase.ts` 里（本来就是给前端用的，公开无妨，数据靠数据库权限保护），也可以用 `.env` 覆盖，见 `.env.example`。

界面文字用中文原文做键，英文在 `src/i18n/en.ts`。

## 发布

推到 `main` 后 GitHub Actions 自动打包，把 `dist` 推到 `gh-pages` 分支；GitHub Pages 从 `gh-pages` 分支发布。
