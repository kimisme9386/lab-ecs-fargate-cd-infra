from flask import Flask
import time

app = Flask(__name__)


@app.route('/')
def welcome():
    return 'Welcome to flask framework. Version:1'


@app.route('/delay')
def deploy():
    time.sleep(5)
    return 'Delay api for test. Version:1'


@app.route('/hello')
def health_check():
    return 'It\'s version:1'


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=80)
