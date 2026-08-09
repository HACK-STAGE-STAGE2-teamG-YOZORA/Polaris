# Polaris

> 経験を言葉にし、納得できる就活の軸を見つける。ローカルAIを活用した自己分析・ES推敲サービス。

Polarisは、就活を始めた学生が「自分の経験をうまく言語化できない」「生成AIが事実を盛ってしまう」という悩みを解決するWebアプリです。AIとの対話から経験を整理し、根拠をたどれる自己分析と、確認済みの事実だけに基づくES推敲を支援します。

## 主な機能

- **対話型の自己分析** — AIが一問ずつ経験を深掘りし、内容を経験カードとして整理
- **根拠付き4軸分析** — Focus / Connect、Plan / Experiment、Mastery / Impact、Stable / Dynamicの4軸で傾向を可視化
- **経験の確認・蓄積** — AIの解釈を本人が修正・確認し、すべての分析結果から発言や経験まで遡れる設計
- **ESの検査・推敲** — テキスト・画像・PDFからESを取り込み、設問・文字数・本人経験・企業情報との整合性を確認
- **事実に基づく改善提案** — 未確認の数字や役割を創作せず、変更理由と根拠を示した完成版ES案を生成

## 利用の流れ

1. Googleアカウントでログイン
2. AIとの会話を通して経験を振り返る
3. 経験カードと4軸の分析結果を自分で確認する
4. ESを入力し、蓄積した経験を根拠に検査・推敲する
5. 修正版を再検査し、提出前の確認を完了する

## 特徴

Polarisは、MBTIのように人を固定的なタイプへ分類しません。分析はあくまで現在の経験から得られる仮説として扱い、「状況による」「根拠が足りない」という結果もそのまま示します。また、AI処理にはLM Studio上のローカルLLMを利用し、本人が確認した経験と出典付きの企業情報を根拠として回答を生成します。

## ローカルでの起動

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run prisma:generate
npm.cmd run db:migrate:deploy
npm.cmd run dev
```

PostgreSQLとLM Studioを起動し、`.env`へ接続情報とGoogle OAuthの認証情報を設定してください。詳しい構成や仕様は[設計ドキュメント](./docs/README.md)を参照してください。

## Tech Stack

### Frontend

<p>
  <img src="https://skillicons.dev/icons?i=ts,nextjs,react,materialui" alt="TypeScript, Next.js, React, Material UI" />
</p>

### Backend / AI

<p>
  <img src="https://skillicons.dev/icons?i=nodejs,prisma,postgres" alt="Node.js, Prisma, PostgreSQL" />
  &nbsp;
  <img src="https://img.shields.io/badge/LM_Studio-151515?style=for-the-badge&logo=lmstudio&logoColor=white" alt="LM Studio" />
</p>
