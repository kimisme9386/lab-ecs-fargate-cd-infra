FROM public.ecr.aws/lambda/nodejs:14

COPY . .

RUN npm i newman -g && \
  npm ci

CMD [ "app.handler" ]  