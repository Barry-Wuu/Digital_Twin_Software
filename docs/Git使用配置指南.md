# Git使用配置指南
[参考视频（该视频仅供参考，具体操作请严格按照下面的规范操作）](https://www.bilibili.com/video/BV19e4y1q7JJ/?spm_id_from=333.999.0.0&vd_source=4f7244b037b690184e273c18093968d0)
## 配置
- 配置本机电脑邮箱以及用户名
    - 邮箱（目前大家的注册邮箱均为`me+名字拼音@mail.scut.edu.cn`）： git config --global user.email "your@mail.scut.edu.cn"
        - 例如`罗漪雄`的邮箱为`meluoyixiong@mail.scut.edu.cn`
    - 用户名（姓名拼音）： git config --global user.name "Your Name"

## Git使用规范
`注意，括号内为示例命令，需要根据具体情况进行修改`
1.  clone项目到本地(`git clone https://p605z95310.zicp.fun/SCUTCaiHu/Test.git`）
	1. 注意：首次克隆后不用执行`git pull`更新，其他时候只更新不克隆)
2.  切换到dev开发分支（`git checkout dev`）
3.  查看当前分支（`git branch -a`）
4.  更新项目dev分支到本地(`git pull`)
5.  创建本地临时开发分支（`git checkout -b lsy`）
6.  `编辑内容`（修改原有项目文件或者新增文件）
7.  在`Test`目录下启动`git bash`查看项目的状态(`git status`)
8.  跟踪当前目录下的所有文件(`git add ./`)
9.  再次查看项目状态(`git status`)
10.  编写提交信息标题(`git commit -m ‘这里是需要自己填写的标题’`)
11.  切换到开发分支dev（`git checkout dev`）
12.  更新项目dev分支到本地(`git pull`)
13.  合并lsy临时分支到当前分支（`git merge lsy`）
14.  提交到github的远程仓库(`git push`)
15.  此时你可以删除lsy临时分支，也可以保留（若保留，记得每次开发前先将dev分支代码merge到lsy分支）

如果遇到要`回退版本`的情况的话，建议用revert命令，[具体使用链接](https://blog.csdn.net/yxlshk/article/details/79944535)

## Rebase操作

如果在写代码的过程中，需要获取远程最新版本的基础上进行修改，可以进行如下操作：

1. 切换到 dev 分支（`git checkout dev`）

2. 更新项目dev分支到本地（`git pull`）

3. 切换到 lsy 分支（`git checkout lsy`）

4. 对 lsy 分支进行变基操作（`git rebase dev`）

5. 接下去重复上面从第7步开始的步骤即可