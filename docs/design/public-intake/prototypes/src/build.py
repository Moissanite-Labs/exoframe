import json,re
head=open('src/_head.txt').read();foot=open('src/_foot.txt').read()
data=json.dumps(json.load(open('data/ideas.json')))
for p,n in [('index',0),('submit',1),('queue',2)]:
    h=head.replace('NAV1>',' aria-current="page">' if n==1 else '>').replace('NAV2>',' aria-current="page">' if n==2 else '>')
    s=open('src/'+p+'.src').read().replace('{{HEAD}}',h).replace('{{FOOT}}',foot).replace('{{DATA}}',data)
    open(p+'.html','w').write(s)
