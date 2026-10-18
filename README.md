# 视觉一体机应用软件

视觉一体机应用软件的新项目仓库，供三位成员共同维护需求、设计、源码与测试。当前为项目初始化阶段，尚未确定技术栈，暂无可运行的应用。

## 项目目录

```text
vision-appliance-software/
├── README.md                    # 项目入口与当前状态
├── CONTRIBUTING.md              # 三人协作、分支与提交约定
├── .gitignore                   # 排除密钥、依赖环境和运行输出
├── .github/
│   ├── ISSUE_TEMPLATE/          # 缺陷与功能需求模板
│   └── pull_request_template.md # 代码变更说明与验证记录模板
├── docs/README.md               # 需求、架构及使用说明的存放约定
├── src/README.md                # 应用源码目录说明
└── tests/README.md              # 测试目录说明
```

## 三人协作

仓库负责人为 [jiacheng299](https://github.com/jiacheng299)。另外两位成员暂未邀请；确定账号后，通过 **Settings → Collaborators → Add people** 邀请，接受邀请后即可提交分支。

每项需求先建立 Issue 并指定一位负责人。开发时从最新 `main` 创建个人任务分支，完成后提交 Pull Request，建议由另一位成员审查后合并。具体操作见 [协作指南](CONTRIBUTING.md)。

## 获取项目

```bash
git clone https://github.com/jiacheng299/vision-appliance-software.git
cd vision-appliance-software
```

确定技术栈、依赖与启动方式后，应在本文件补充安装、运行及测试命令。

## 项目状态

- 仓库公开，任何人均可查看；写入权限由负责人管理。
- 当前只包含项目结构与协作资料，后续在本仓库开展新应用开发。
- 尚未选择开源许可证；需要对外授权使用时，由团队明确许可证。
