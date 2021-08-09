FROM public.ecr.aws/lambda/python:3.8

COPY . .

RUN pip install --upgrade pip && \
  pip install pipenv

ENV PATH="${PATH}:/root/.local/bin"

RUN pipenv --python 3.8 && \
  pipenv install --system

CMD ["app.handler"]  